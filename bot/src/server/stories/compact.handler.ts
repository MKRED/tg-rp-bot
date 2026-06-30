import { getNarratorTemplate } from "../../db/narratorTemplates/index.js";
import { getPreset } from "../../db/presets/index.js";
import {
  deleteCompactionCascade,
  getStory,
  getStorySettings,
  insertCompaction,
  listCompactions,
  nextCompactionSeq,
} from "../../db/stories/index.js";
import type { StoryCompactionRow } from "../../db/stories/index.js";
import { chatCompletion } from "../../llm/client.js";
import type { ChatMessage } from "../../llm/types.js";
import logger from "../../logger.js";
import { countTokens, retry } from "../../utils/index.js";
import { PER_MESSAGE_OVERHEAD } from "../prompt/budget.js";
import { planCompactionSegments, selectValidChain } from "../prompt/compactionPlan.js";
import {
  COMPACTION_CONTEXT_HEADER,
  CONTINUE_MARKER,
  DEFAULT_COMPACTION_PROMPT,
  DEFAULT_NARRATOR_PROMPT_ORDER,
} from "../prompt/storyPromptBuilder.js";
import { normalizeStoryPromptOrder } from "../prompt/storyPromptOrder.js";
import { compactAvailable, resolveCompactFloor } from "./compact.gate.js";
import type { Ctx } from "./stories.types.js";
import { buildStoryCompletionInput } from "./storyContext.js";

export type CompactStoryResult =
  | { ok: true; created: number }
  | { ok: false; status: 404 | 409; reason: string };

// Lock по storyId: ручной POST /compact, авто-триггер при advance и параллельные advance не должны
// сжимать одновременно (двойной seq, гонки якорей). См. паттерн processing-lock в CLAUDE.md.
const compacting = new Set<number>();

/**
 * Один проход сжатия истории: сегментирует старейшие сообщения живого хвоста в пересказы (по
 * ~contextSize−floor токенов каждый), стремясь привести общий вход к floor. План считается ОДИН раз
 * по состоянию до сжатия (planCompactionSegments), поэтому токены самих новых пересказов в floor не
 * заложены — фактический вход может остаться чуть выше floor (предохранитель — trimHistoryToBudget).
 * Каждый сегмент → отдельный LLM-вызов (прошлые пересказы передаются как «story so far»), результат
 * шифруется в story_compactions. Возвращает число созданных пересказов (0 = нечего сжимать — no-op).
 */
export async function compactStory(userId: number, storyId: number): Promise<CompactStoryResult> {
  if (compacting.has(storyId)) return { ok: false, status: 409, reason: "busy" };
  compacting.add(storyId);
  const t0 = Date.now();
  try {
    const story = await getStory(userId, storyId);
    if (!story) return { ok: false, status: 404, reason: "not_found" };

    const preset = story.preset ? await getPreset(userId, story.preset.id) : null;
    if (!compactAvailable(preset)) return { ok: false, status: 409, reason: "unavailable" };
    // compactAvailable гарантирует contextSize != null.
    const contextSize = preset!.contextSize!;

    const template = story.template ? await getNarratorTemplate(userId, story.template.id) : null;
    const promptOrder = template
      ? normalizeStoryPromptOrder(template.promptOrder)
      : DEFAULT_NARRATOR_PROMPT_ORDER;
    const compactComponentOn = promptOrder.some((i) => i.id === "compact" && i.enabled);
    const settings = await getStorySettings(storyId);
    if (!compactComponentOn || !settings.compactEnabled) {
      return { ok: false, status: 409, reason: "gate_off" };
    }
    if (story.activeMessageId == null) return { ok: false, status: 409, reason: "no_active" };

    const floor = resolveCompactFloor(settings.compactFloorTokens, contextSize, preset!.maxTokens);
    const segmentSize = Math.max(1, contextSize - floor);

    // Существующая цепочка пересказов и живой хвост (сообщения после последнего якоря).
    const pathIds = new Set(story.messages.map((m) => m.id));
    const chain = selectValidChain(await listCompactions(userId, storyId), pathIds);
    const lastAnchorId = chain.length > 0 ? chain[chain.length - 1]!.toAnchorId : null;
    const anchorIdx =
      lastAnchorId != null ? story.messages.findIndex((m) => m.id === lastAnchorId) : -1;
    const liveTail = anchorIdx >= 0 ? story.messages.slice(anchorIdx + 1) : story.messages;

    // Текущий общий вход (с уже применёнными пересказами) — через builder (единый источник истины).
    const ctx = await buildStoryCompletionInput(userId, storyId, { trim: false });
    if (!ctx) return { ok: false, status: 404, reason: "not_found" };
    const currentTotal = ctx.msgs.reduce((s, m) => s + countTokens(m.content) + PER_MESSAGE_OVERHEAD, 0);

    // Стоимость каждого сообщения хвоста КАК В ПРОМПТЕ: отыгранные user-ходы нейтрализуются в
    // CONTINUE_MARKER (кроме последнего/живого). overhead = всё, что вне хвоста (system-блоки +
    // пересказы + leading-user) = currentTotal − сумма хвоста.
    const lastTailIdx = liveTail.length - 1;
    const tailItems = liveTail.map((m, i) => ({
      isBeat: m.kind === "beat",
      tokens:
        (m.role === "user" && i !== lastTailIdx
          ? countTokens(CONTINUE_MARKER)
          : countTokens(m.content)) + PER_MESSAGE_OVERHEAD,
    }));
    const tailSum = tailItems.reduce((s, t) => s + t.tokens, 0);
    const planOverhead = currentTotal - tailSum;

    const segments = planCompactionSegments(tailItems, planOverhead, floor, segmentSize);
    if (segments.length === 0) {
      logger.info({ userId, storyId, currentTotal, floor }, "Story compaction no-op (nothing to compact)");
      return { ok: true, created: 0 };
    }

    // Промпт сжатия из шаблона (или дефолт) с подставленным числом слов.
    const compactionPrompt = (template?.compactionPrompt.trim() || DEFAULT_COMPACTION_PROMPT).replaceAll(
      "{{words}}",
      String(settings.compactWords),
    );

    let seq = await nextCompactionSeq(storyId);
    let fromAnchorId: number | null = lastAnchorId;
    const priorSummaries = chain.map((c) => c.summary); // прошлые пересказы как «story so far»

    for (const seg of segments) {
      const anchorMsg = liveTail[seg[seg.length - 1]!]!; // последний индекс сегмента — бит
      // На суммаризацию идут ТОЛЬКО биты (их повествование); директивы/continue пропускаем — их
      // эффект уже вплетён в биты. coveredCount/coveredTokens при этом считают ВЕСЬ диапазон сегмента
      // (вкл. директивы), т.к. из живой истории убираются все эти сообщения, не только биты.
      const beatTexts = seg
        .map((i) => liveTail[i]!)
        .filter((m) => m.kind === "beat")
        .map((m) => m.content);
      const coveredTokens = seg.reduce((s, i) => s + tailItems[i]!.tokens, 0);

      const messages: ChatMessage[] = [{ role: "system", content: compactionPrompt }];
      if (priorSummaries.length > 0) {
        messages.push({
          role: "system",
          content: `${COMPACTION_CONTEXT_HEADER}\n\n${priorSummaries.join("\n\n")}`,
        });
      }
      messages.push({ role: "user", content: beatTexts.join("\n\n") });

      const result = await retry(
        () => chatCompletion({ messages, userId, debugLabel: "compact" }),
        3,
        1500,
        "compactStory",
      );
      const summary = result.content.trim();

      await insertCompaction(userId, storyId, {
        seq,
        fromAnchorId,
        toAnchorId: anchorMsg.id,
        summary,
        coveredCount: seg.length,
        coveredTokens,
      });
      priorSummaries.push(summary);
      fromAnchorId = anchorMsg.id;
      seq += 1;
    }

    logger.info(
      { durationMs: Date.now() - t0, userId, storyId, created: segments.length, floor },
      "Story compaction done",
    );
    return { ok: true, created: segments.length };
  } finally {
    compacting.delete(storyId);
  }
}

/**
 * Нужно ли авто-сжатие перед генерацией бита: оба гейта фичи + авто включены, фича доступна, и
 * полный вход (с уже применёнными пересказами) достиг лимита контекста. Считается тем же токенайзером.
 */
export async function shouldAutoCompact(userId: number, storyId: number): Promise<boolean> {
  const settings = await getStorySettings(storyId);
  if (!settings.compactEnabled || !settings.compactAutoEnabled) return false;
  const input = await buildStoryCompletionInput(userId, storyId, { trim: false });
  if (!input || !input.compactComponentEnabled || !compactAvailable(input.preset)) return false;
  const contextSize = input.preset!.contextSize!;
  const total = input.msgs.reduce((s, m) => s + countTokens(m.content) + PER_MESSAGE_OVERHEAD, 0);
  return total >= contextSize;
}

/** Лёгкая проекция пересказа для webapp (без anchor-id — они внутренние). */
type CompactionView = {
  id: number;
  seq: number;
  summary: string;
  coveredCount: number;
  coveredTokens: number;
};

function toView(c: StoryCompactionRow): CompactionView {
  return { id: c.id, seq: c.seq, summary: c.summary, coveredCount: c.coveredCount, coveredTokens: c.coveredTokens };
}

/** Валидная цепочка пересказов активной ветки (для списка в настройках). [] если истории нет. */
async function activeBranchCompactions(userId: number, storyId: number): Promise<StoryCompactionRow[]> {
  const story = await getStory(userId, storyId);
  if (!story || story.activeMessageId == null) return [];
  const pathIds = new Set(story.messages.map((m) => m.id));
  return selectValidChain(await listCompactions(userId, storyId), pathIds);
}

/** POST /:id/compact — ручное сжатие (один проход). Возвращает число созданных + обновлённый список. */
export async function handleCompactStory(c: Ctx) {
  const user = c.get("tgUser");
  if (!user) return c.json({ error: "Auth required" }, 401);
  const userId = user.id;
  const storyId = Number(c.req.param("id"));
  try {
    const result = await compactStory(userId, storyId);
    if (!result.ok) return c.json({ error: result.reason }, result.status);
    const compactions = (await activeBranchCompactions(userId, storyId)).map(toView);
    return c.json({ created: result.created, compactions });
  } catch (err) {
    logger.error({ err, userId, storyId }, "Failed to compact story");
    return c.json({ error: "Internal error" }, 500);
  }
}

/** GET /:id/compactions — пересказы активной ветки (текстом, для настроек). */
export async function handleListCompactions(c: Ctx) {
  const user = c.get("tgUser");
  if (!user) return c.json({ error: "Auth required" }, 401);
  const userId = user.id;
  const storyId = Number(c.req.param("id"));
  try {
    const story = await getStory(userId, storyId);
    if (!story) return c.json({ error: "Story not found" }, 404);
    const compactions = (await activeBranchCompactions(userId, storyId)).map(toView);
    return c.json({ compactions });
  } catch (err) {
    logger.error({ err, userId, storyId }, "Failed to list compactions");
    return c.json({ error: "Internal error" }, 500);
  }
}

/** DELETE /:id/compactions/:cid — удалить пересказ каскадом вперёд. Возвращает обновлённый список. */
export async function handleDeleteCompaction(c: Ctx) {
  const user = c.get("tgUser");
  if (!user) return c.json({ error: "Auth required" }, 401);
  const userId = user.id;
  const storyId = Number(c.req.param("id"));
  const compactionId = Number(c.req.param("cid"));
  try {
    const story = await getStory(userId, storyId);
    if (!story) return c.json({ error: "Story not found" }, 404);
    const deleted = await deleteCompactionCascade(storyId, compactionId);
    if (!deleted) return c.json({ error: "Compaction not found" }, 404);
    const compactions = (await activeBranchCompactions(userId, storyId)).map(toView);
    return c.json({ compactions });
  } catch (err) {
    logger.error({ err, userId, storyId, compactionId }, "Failed to delete compaction");
    return c.json({ error: "Internal error" }, 500);
  }
}
