import { streamSSE } from "hono/streaming";
import { getActiveEntriesForPrompt } from "../../db/knowledge/index.js";
import { getNarratorTemplate } from "../../db/narratorTemplates/index.js";
import { getPreset } from "../../db/presets/index.js";
import {
  deleteStoryMessage,
  findNewestStoryChild,
  getStory,
  getStoryMessage,
  insertStoryMessage,
  saveStoryTranslation,
  setActiveStoryMessage,
  updateActiveStoryMessage,
} from "../../db/stories/index.js";
import logger from "../../logger.js";
import { presetToCompletionOptions } from "../prompt/promptBuilder.js";
import {
  buildStoryMessages,
  CONTINUE_MARKER,
  DEFAULT_NARRATOR_PROMPT_ORDER,
  DEFAULT_NARRATOR_TEMPLATE,
} from "../prompt/storyPromptBuilder.js";
import { streamCompletion } from "../shared/streamGeneration.js";
import { googleTranslate } from "../shared/translate.js";
import type { Ctx } from "./stories.types.js";

/**
 * Собирает вход для narrator-генерации из текущего состояния истории: системный промпт (из шаблона
 * или дефолт), премиза, always_on книги знаний и активный путь (с нейтрализацией внутри builder).
 * Курсор истории на момент вызова должен стоять на живом user-ходе (триггере).
 */
async function buildStoryCompletionInput(userId: number, storyId: number) {
  const story = await getStory(userId, storyId);
  if (!story) return null;

  const template = story.template ? await getNarratorTemplate(userId, story.template.id) : null;
  const systemPrompt =
    template && template.systemPrompt.trim() ? template.systemPrompt : DEFAULT_NARRATOR_TEMPLATE;
  const auxiliarySystemPrompt = template?.auxiliarySystemPrompt ?? "";
  const postHistoryInstruction = template?.postHistoryInstruction ?? "";
  const promptOrder = template?.promptOrder ?? DEFAULT_NARRATOR_PROMPT_ORDER;

  const preset = story.preset ? await getPreset(userId, story.preset.id) : null;

  // Книга знаний: в MVP в промпт идут только always_on-записи (keyword — задел).
  const entries = await getActiveEntriesForPrompt(userId, story.book.id);
  const lorebook = entries
    .filter((e) => e.activation === "always_on")
    .map((e) => e.text)
    .filter((t) => t.trim());

  const msgs = buildStoryMessages({
    systemPrompt,
    auxiliarySystemPrompt,
    postHistoryInstruction,
    premise: story.premise,
    lorebook,
    promptOrder,
    history: story.messages,
    contextUnlimited: preset?.contextUnlimited,
    contextSize: preset?.contextSize,
    maxTokens: preset?.maxTokens,
    onTrim: ({ dropped, kept, total }) =>
      logger.info({ userId, storyId, dropped, kept, total }, "Story history trimmed to context budget"),
  });

  const samplingOpts = preset ? presetToCompletionOptions(preset) : {};
  return { msgs, samplingOpts };
}

/**
 * POST /:id/advance — двигает историю вперёд. body { directive?: string }:
 * непустая директива → user-ход kind="directive" с её текстом; пусто → kind="continue" (маркер).
 * Затем стримит следующий бит. «Дальше» и режиссёрская директива — один и тот же механизм.
 */
export async function handleAdvanceStory(c: Ctx) {
  const user = c.get("tgUser");
  if (!user) return c.json({ error: "Auth required" }, 401);
  const userId = user.id;
  const storyId = Number(c.req.param("id"));

  const body = (await c.req.json().catch(() => ({}))) as { directive?: string };
  const directive = typeof body.directive === "string" ? body.directive.trim() : "";

  const story = await getStory(userId, storyId);
  if (!story) return c.json({ error: "Story not found" }, 404);
  const parentBeatId = story.activeMessageId;
  if (parentBeatId == null) return c.json({ error: "Story has no active beat" }, 400);

  const kind = directive ? "directive" : "continue";
  const content = directive || CONTINUE_MARKER;

  return streamSSE(c, async (stream) => {
    let steerId: number | null = null;
    try {
      // Эфемерный user-ход как ребёнок последнего бита; курсор ставим на него (живой триггер).
      const steer = await insertStoryMessage(userId, storyId, parentBeatId, "user", kind, content);
      steerId = steer.id;
      await setActiveStoryMessage(storyId, steer.id);
      await stream.writeSSE({ event: "userMessage", data: JSON.stringify(steer) });

      const input = await buildStoryCompletionInput(userId, storyId);
      if (!input) throw new Error("Failed to build story context");

      const result = await streamCompletion(stream, {
        messages: input.msgs,
        ...input.samplingOpts,
        userId,
        debugLabel: "narrator",
      });

      const beat = await insertStoryMessage(userId, storyId, steer.id, "assistant", "beat", result.content);
      await updateActiveStoryMessage(storyId, beat.id);
      await stream.writeSSE({ event: "done", data: JSON.stringify(beat) });
    } catch (err) {
      logger.error({ err, userId, storyId }, "advanceStory stream error");
      // Откат висящего user-хода без бита: удаляем его (курсор вернётся к родительскому биту).
      if (steerId != null) {
        await deleteStoryMessage(userId, storyId, steerId).catch((rollbackErr) =>
          logger.error({ err: rollbackErr, userId, storyId, steerId }, "Failed to roll back dangling story steer"),
        );
      }
      await stream.writeSSE({ event: "error", data: JSON.stringify({ message: "Generation failed" }) });
    }
  });
}

/**
 * POST /:id/messages/:msgId/regenerate — перегенерирует бит как нового сиблинга под тем же user-ходом
 * (та же директива переприменяется автоматически). Корневой openingBeat регенерировать нельзя.
 */
export async function handleRegenerateStoryBeat(c: Ctx) {
  const user = c.get("tgUser");
  if (!user) return c.json({ error: "Auth required" }, 401);
  const userId = user.id;
  const storyId = Number(c.req.param("id"));
  const msgId = Number(c.req.param("msgId"));

  const story = await getStory(userId, storyId);
  if (!story) return c.json({ error: "Story not found" }, 404);

  const beat = await getStoryMessage(userId, msgId);
  if (!beat || beat.storyChatId !== storyId) return c.json({ error: "Message not found" }, 404);
  if (beat.role !== "assistant") return c.json({ error: "Can only regenerate a beat" }, 400);
  if (beat.parentId == null) return c.json({ error: "Cannot regenerate the opening beat" }, 400);

  const steerId = beat.parentId;
  // Курсор на родительский user-ход (живой триггер) — путь закончится на нём, как нужно builder'у.
  await setActiveStoryMessage(storyId, steerId);

  const input = await buildStoryCompletionInput(userId, storyId);
  if (!input) return c.json({ error: "Story not found" }, 404);

  return streamSSE(c, async (stream) => {
    try {
      const result = await streamCompletion(stream, {
        messages: input.msgs,
        ...input.samplingOpts,
        userId,
        debugLabel: "narrator",
      });
      const newBeat = await insertStoryMessage(userId, storyId, steerId, "assistant", "beat", result.content);
      await updateActiveStoryMessage(storyId, newBeat.id);
      await stream.writeSSE({ event: "done", data: JSON.stringify(newBeat) });
    } catch (err) {
      logger.error({ err, userId, storyId }, "regenerateStoryBeat stream error");
      // Возвращаем курсор на исходный бит, чтобы история не «откатилась» к user-ходу.
      await updateActiveStoryMessage(storyId, beat.id).catch((rollbackErr) =>
        logger.error({ err: rollbackErr, userId, storyId, beatId: beat.id }, "Failed to restore story cursor after regenerate"),
      );
      await stream.writeSSE({ event: "error", data: JSON.stringify({ message: "Generation failed" }) });
    }
  });
}

/**
 * POST /:id/messages/:msgId/branch — переключает активную ветку. По биту фиксируем курсор ровно
 * на узле (можно ответвиться отсюда — как в RP-графе). По user-ходу (директива/«Дальше») курсор
 * ставить нельзя: это эфемерный триггер, история обязана заканчиваться битом (тот же инвариант,
 * что чинит pruneOrphanSteers при удалении) — спускаемся к его биту-листу. В ленте по стрелкам
 * переключают только биты, поэтому развилка важна лишь для клика по узлу в графе.
 */
export async function handleSwitchStoryBranch(c: Ctx) {
  const user = c.get("tgUser");
  if (!user) return c.json({ error: "Auth required" }, 401);
  const userId = user.id;
  const storyId = Number(c.req.param("id"));
  const msgId = Number(c.req.param("msgId"));

  try {
    const story = await getStory(userId, storyId);
    if (!story) return c.json({ error: "Story not found" }, 404);

    const msg = await getStoryMessage(userId, msgId);
    if (!msg || msg.storyChatId !== storyId) return c.json({ error: "Message not found" }, 404);

    if (msg.kind === "beat") {
      await setActiveStoryMessage(storyId, msgId);
    } else {
      // Директива/«Дальше» — эфемерный триггер, курсор на него ставить нельзя. Встаём ровно на ЕГО
      // бит (самого свежего прямого ребёнка), а НЕ спускаемся к самому глубокому листу — иначе клик
      // по узлу в середине дерева увёл бы в конец истории, и ответвиться из середины было бы нельзя.
      // Ребёнок директивы всегда бит (строгое чередование). Висячая директива без бита (легаси/
      // середина генерации) — откатываемся на родительский бит (parentId у user-хода всегда бит).
      const beatId = (await findNewestStoryChild(storyId, msgId)) ?? msg.parentId;
      await setActiveStoryMessage(storyId, beatId);
    }
    return c.json({ ok: true });
  } catch (err) {
    logger.error({ err, userId, storyId, msgId }, "Failed to switch story branch");
    return c.json({ error: "Internal error" }, 500);
  }
}

/** POST /:id/messages/:msgId/translate — переводит бит/директиву и кэширует результат (зеркало RP). */
export async function handleStoryTranslateMessage(c: Ctx) {
  const user = c.get("tgUser");
  if (!user) return c.json({ error: "Auth required" }, 401);
  const userId = user.id;
  const storyId = Number(c.req.param("id"));
  const msgId = Number(c.req.param("msgId"));

  const body = (await c.req.json().catch(() => ({}))) as { targetLang?: string };
  const targetLang = typeof body.targetLang === "string" ? body.targetLang.trim() : "";
  if (!targetLang) return c.json({ error: "targetLang is required" }, 400);

  const t0 = Date.now();
  try {
    // Принадлежность проверяем через storyId→userId, затем сверяем, что сообщение из этой истории.
    const story = await getStory(userId, storyId);
    if (!story) return c.json({ error: "Story not found" }, 404);

    const msg = await getStoryMessage(userId, msgId);
    if (!msg || msg.storyChatId !== storyId) return c.json({ error: "Message not found" }, 404);

    // Кэш уже есть (translations расшифрованы в getStoryMessage) — не дёргаем переводчик повторно.
    const cached = (msg.translations as Record<string, string> | null)?.[targetLang];
    if (cached) return c.json({ translation: cached });

    const translation = await googleTranslate(msg.content, targetLang);
    await saveStoryTranslation(userId, msgId, targetLang, translation);
    logger.info(
      { durationMs: Date.now() - t0, userId, storyId, msgId, targetLang },
      "Story message translated",
    );
    return c.json({ translation });
  } catch (err) {
    logger.error({ err, userId, storyId, msgId }, "Failed to translate story message");
    return c.json({ error: "Internal error" }, 500);
  }
}

/** DELETE /:id/messages/:msgId — удаляет сообщение и поддерево (корневой openingBeat удалять нельзя). */
export async function handleDeleteStoryMessage(c: Ctx) {
  const user = c.get("tgUser");
  if (!user) return c.json({ error: "Auth required" }, 401);
  const userId = user.id;
  const storyId = Number(c.req.param("id"));
  const msgId = Number(c.req.param("msgId"));

  try {
    const story = await getStory(userId, storyId);
    if (!story) return c.json({ error: "Story not found" }, 404);

    const msg = await getStoryMessage(userId, msgId);
    if (!msg || msg.storyChatId !== storyId) return c.json({ error: "Message not found" }, 404);
    if (msg.parentId == null) return c.json({ error: "Cannot delete the opening beat" }, 400);

    const deleted = await deleteStoryMessage(userId, storyId, msgId);
    if (!deleted) return c.json({ error: "Message not found" }, 404);
    return c.json({ ok: true });
  } catch (err) {
    logger.error({ err, userId, storyId, msgId }, "Failed to delete story message");
    return c.json({ error: "Internal error" }, 500);
  }
}
