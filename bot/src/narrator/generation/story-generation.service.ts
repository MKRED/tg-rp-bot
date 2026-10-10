import { BadRequestException, Injectable, type MessageEvent } from "@nestjs/common";
import { SSE_EVENTS } from "@tg-rp-bot/shared";
import type { Observable } from "rxjs";
import { sseObservable } from "../../common/sse-observable.js";
import { type SseSink, streamCompletion, writeEvent, writeGenerationError } from "../../common/stream-completion.js";
import { LlmService } from "../../llm/llm.service.js";
import logger from "../../logger.js";
import { NarratorTemplatesRepository } from "../../narrator-templates/narrator-templates.repository.js";
import { resolveNarratorMarkers } from "../../prompt/storyPromptBuilder/index.js";
import { StoryCompactionService } from "../compaction/story-compaction.service.js";
import { needsAutoCompaction } from "../compaction/story-compaction-plan.js";
import { StoryMessagesRepository } from "../messages/story-messages.repository.js";
import { StoryContextService } from "../story-context.service.js";
import { buildStoryCompletion, type StoryContext } from "./story-completion.js";

type StoryCompletion = ReturnType<typeof buildStoryCompletion>;

/**
 * Стриминговая narrator-генерация: advance («Дальше» или директива) и регенерация бита. Проверки
 * (404/400) и подготовка — ДО возврата потока, поэтому ошибки уходят обычным JSON; ошибка генерации —
 * событием error в потоке.
 *
 * Инвариант контекста: на момент сборки запроса курсор стоит на живом user-ходе (триггере) — путь
 * заканчивается им, как ждёт storyPromptBuilder (бит-ответ на него генерируется).
 */
@Injectable()
export class StoryGenerationService {
  constructor(
    private readonly access: StoryContextService,
    private readonly messages: StoryMessagesRepository,
    private readonly templates: NarratorTemplatesRepository,
    private readonly compaction: StoryCompactionService,
    private readonly llm: LlmService,
  ) {}

  /**
   * Двигает историю: непустая директива → user-ход kind=directive с её текстом; пусто → kind=continue
   * с маркером шаблона истории (не глобальным дефолтом — иначе кастомный continueMarker разъедется с
   * тем, что сохраняется). Ход — ребёнок последнего бита, курсор на него; затем бит-ответ.
   */
  async advance(userId: number, storyId: number, directive: string): Promise<Observable<MessageEvent>> {
    const story = await this.access.requireRow(userId, storyId);
    const parentBeatId = story.activeMessageId;
    if (parentBeatId == null) throw new BadRequestException("Story has no active beat");
    const kind = directive ? "directive" : "continue";
    let content = directive;
    if (!content) {
      const template = story.templateId ? await this.templates.findOne(userId, story.templateId) : undefined;
      content = resolveNarratorMarkers(template ?? null).continueMarker;
    }

    return sseObservable("narrator advance", async (sink) => {
      let steerId: number | null = null;
      try {
        const steer = await this.messages.insert(userId, storyId, parentBeatId, "user", kind, content);
        steerId = steer.id;
        await this.messages.setCursor(storyId, steer.id);
        await writeEvent(sink, SSE_EVENTS.userMessage, steer);
        let ctx = await this.access.requireContext(userId, storyId);
        // Сжатие меняет историю запроса (пересказы) — контекст перечитываем.
        if (await this.autoCompact(sink, userId, ctx)) ctx = await this.access.requireContext(userId, storyId);
        await this.beat(sink, userId, storyId, steer.id, this.completion(userId, ctx));
      } catch (err) {
        logger.error({ err, userId, storyId }, "advanceStory stream error");
        // Висящий ход без бита — мёртвый триггер: удаляем, курсор вернётся к родительскому биту.
        if (steerId != null) {
          await this.messages
            .removeSubtree(userId, storyId, steerId)
            .catch((rollbackErr: unknown) => logger.error({ err: rollbackErr, userId, storyId, steerId }, "Failed to roll back dangling story steer"));
        }
        await writeGenerationError(sink, err);
      }
    });
  }

  /**
   * Новый бит-сиблинг под тем же user-ходом (директива переприменяется). Открытие регенерировать
   * нельзя: у него нет хода-родителя. Курсор поднимается на ход; при сбое подготовки или генерации
   * возвращается ровно туда, где стоял.
   */
  async regenerate(userId: number, storyId: number, msgId: number): Promise<Observable<MessageEvent>> {
    const { story, msg } = await this.access.requireMessage(userId, storyId, msgId);
    if (msg.role !== "assistant") throw new BadRequestException("Can only regenerate a beat");
    if (msg.parentId == null) throw new BadRequestException("Cannot regenerate the opening beat");
    const steerId = msg.parentId;
    const previous = story.activeMessageId;

    await this.messages.setCursor(storyId, steerId);
    let completion: StoryCompletion;
    try {
      completion = this.completion(userId, await this.access.requireContext(userId, storyId));
    } catch (err) {
      await this.restoreCursor(storyId, previous);
      throw err;
    }
    return sseObservable("narrator regenerate", async (sink) => {
      try {
        await this.beat(sink, userId, storyId, steerId, completion);
      } catch (err) {
        logger.error({ err, userId, storyId }, "regenerateStoryBeat stream error");
        await this.restoreCursor(storyId, previous);
        await writeGenerationError(sink, err);
      }
    });
  }

  /**
   * Авто-сжатие перед битом: вход достиг окна контекста — синхронно сжимаем (статус в ленте) и
   * генерируем уже на освобождённом контексте. Это оптимизация: ни проверка, ни сжатие (в т.ч. busy
   * из-за параллельного прохода) генерацию НЕ роняют — дальше штатная обрезка истории. true — сжатие
   * запускалось: контекст надо перечитать (часть пересказов могла записаться и при сбое прохода).
   */
  private async autoCompact(sink: SseSink, userId: number, ctx: StoryContext): Promise<boolean> {
    const storyId = ctx.story.id;
    try {
      const { msgs, compactComponentEnabled } = buildStoryCompletion(ctx, { trim: false });
      if (!needsAutoCompaction(ctx, msgs, compactComponentEnabled)) return false;
    } catch (err) {
      logger.warn({ err, userId, storyId }, "Auto-compaction check failed; skipping");
      return false;
    }
    await writeEvent(sink, SSE_EVENTS.status, { phase: "compacting" });
    await this.compaction
      .compact(userId, storyId)
      .catch((err: unknown) => logger.error({ err, userId, storyId }, "Auto-compaction failed; proceeding with trim"));
    return true;
  }

  /** Запрос к LLM по контексту; история урезается под окно пресета — фиксируем, сколько выпало. */
  private completion(userId: number, ctx: StoryContext): StoryCompletion {
    const storyId = ctx.story.id;
    return buildStoryCompletion(ctx, {
      onTrim: ({ dropped, kept, total }) => logger.info({ userId, storyId, dropped, kept, total }, "Story history trimmed to context budget"),
    });
  }

  /** Генерирует бит-ответ на ход steerId, сохраняет, ставит курсор на него, пишет done. */
  private async beat(sink: SseSink, userId: number, storyId: number, steerId: number, completion: StoryCompletion): Promise<void> {
    const t0 = Date.now();
    const result = await streamCompletion(this.llm, sink, { messages: completion.msgs, ...completion.samplingOpts, userId, debugLabel: "narrator" });
    const beat = await this.messages.insert(userId, storyId, steerId, "assistant", "beat", result.content);
    await this.messages.moveCursorToLeaf(storyId, beat.id);
    logger.info({ durationMs: Date.now() - t0, userId, storyId, messageId: beat.id }, "Story beat generated");
    await writeEvent(sink, SSE_EVENTS.done, beat);
  }

  /** Курсор ровно на узел (без спуска к листу); сбой отката — лог, а не потеря исходной ошибки. */
  private async restoreCursor(storyId: number, messageId: number | null): Promise<void> {
    await this.messages
      .setCursor(storyId, messageId)
      .catch((err: unknown) => logger.warn({ err, storyId, messageId }, "Failed to restore story cursor"));
  }
}
