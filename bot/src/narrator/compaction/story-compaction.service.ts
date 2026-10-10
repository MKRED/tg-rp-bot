import { ConflictException, HttpException, Injectable, NotFoundException } from "@nestjs/common";
import { llmHttpError } from "../../common/llm-http-error.js";
import { MissingApiKeyError } from "../../llm/errors.js";
import { LlmService } from "../../llm/llm.service.js";
import logger from "../../logger.js";
import { retry } from "../../utils/index.js";
import { buildStoryCompletion, type StoryContext } from "../generation/story-completion.js";
import { StoryContextService } from "../story-context.service.js";
import { CompactionsRepository } from "./compactions.repository.js";
import { compactBlockReason, compactionPrompt, compactionRequest, planStoryCompaction } from "./story-compaction-plan.js";

/**
 * Сжатие истории: старейшие сообщения живого хвоста → пересказы (отдельный LLM-вызов на сегмент,
 * summary шифруется в story_compactions). Триггеры — ручной POST /compact и авто перед битом в advance.
 *
 * Блокировка по storyId — поле синглтона, общая для ручного сжатия и авто-сжатия любого advance: два
 * сжатия одной истории разом дали бы двойной seq и гонку якорей (паттерн processing-lock, CLAUDE.md).
 */
@Injectable()
export class StoryCompactionService {
  private readonly compacting = new Set<number>();

  constructor(
    private readonly access: StoryContextService,
    private readonly compactions: CompactionsRepository,
    private readonly llm: LlmService,
  ) {}

  /**
   * Один проход сжатия. Возвращает число созданных пересказов (0 — сжимать нечего). Отказы — с телами
   * Hono-версии: 404 not_found, 409 busy / unavailable / gate_off / no_active; сбой LLM — 400
   * no_api_key или 500.
   */
  async compact(userId: number, storyId: number): Promise<number> {
    if (this.compacting.has(storyId)) throw new ConflictException("busy");
    this.compacting.add(storyId);
    const t0 = Date.now();
    try {
      const ctx = await this.access.requireContext(userId, storyId).catch((err: unknown) => {
        throw err instanceof NotFoundException ? new NotFoundException("not_found") : err;
      });
      const { msgs, compactComponentEnabled } = buildStoryCompletion(ctx, { trim: false });
      const blocked = compactBlockReason(ctx, compactComponentEnabled);
      if (blocked) throw new ConflictException(blocked);

      const { floor, chain, segments } = planStoryCompaction(ctx, msgs);
      if (segments.length === 0) {
        logger.info({ userId, storyId, floor }, "Story compaction no-op (nothing to compact)");
        return 0;
      }
      await this.summarize(userId, ctx, segments, chain.map((c) => c.summary), chain.at(-1)?.toAnchorId ?? null);
      logger.info({ durationMs: Date.now() - t0, userId, storyId, created: segments.length, floor }, "Story compaction done");
      return segments.length;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      if (err instanceof MissingApiKeyError) logger.warn({ userId, storyId }, "Story compaction: не задан ключ DeepSeek");
      else logger.error({ err, userId, storyId }, "Failed to compact story");
      throw llmHttpError(err);
    } finally {
      this.compacting.delete(storyId);
    }
  }

  /** Пересказ каждого сегмента по очереди: прошлые пересказы (и только что созданные) — «story so far». */
  private async summarize(
    userId: number,
    ctx: StoryContext,
    segments: ReturnType<typeof planStoryCompaction>["segments"],
    priorSummaries: string[],
    lastAnchorId: number | null,
  ): Promise<void> {
    const storyId = ctx.story.id;
    const prompt = compactionPrompt(ctx.template, ctx.settings.compactWords);
    let seq = await this.compactions.nextSeq(storyId);
    let fromAnchorId = lastAnchorId;
    for (const seg of segments) {
      const result = await retry(
        // Сжатие — задача на рассуждение (выделить главное, связать события): «мышление» просим всегда,
        // уровень — из пресета истории.
        () =>
          this.llm.complete({
            messages: compactionRequest(prompt, priorSummaries, seg.beatTexts),
            userId,
            debugLabel: "compact",
            requestReasoning: true,
            reasoningEffort: ctx.preset?.reasoningEffort ?? undefined,
          }),
        3,
        1500,
        "compactStory",
        (err) => !(err instanceof MissingApiKeyError),
      );
      const summary = result.content.trim();
      await this.compactions.insert(userId, storyId, {
        seq,
        fromAnchorId,
        toAnchorId: seg.anchorId,
        summary,
        coveredCount: seg.coveredCount,
        coveredTokens: seg.coveredTokens,
      });
      priorSummaries.push(summary);
      fromAnchorId = seg.anchorId;
      seq += 1;
    }
  }
}
