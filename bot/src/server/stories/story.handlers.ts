import { streamSSE } from "hono/streaming";
import {
  deleteStoryMessage,
  deleteStoryTranslation,
  findNewestStoryChild,
  getStory,
  getStoryMessage,
  getStorySettings,
  insertStoryMessage,
  saveStoryTranslation,
  setActiveStoryMessage,
  updateActiveStoryMessage,
} from "../../db/stories/index.js";
import { getNarratorTemplate } from "../../db/narratorTemplates/index.js";
import logger from "../../logger.js";
import { resolveNarratorMarkers } from "../prompt/storyPromptBuilder/index.js";
import { streamCompletion } from "../shared/streamGeneration.js";
import {
  aiTranslate,
  englishLangName,
  googleTranslate,
  resolveTranslationReasoning,
} from "../shared/translate.js";
import { compactStory, shouldAutoCompact } from "./compact.handler.js";
import { buildStoryCompletionInput } from "./storyContext.js";
import type { Ctx } from "./stories.types.js";

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
  // Живой continue-триггер пишем маркером шаблона истории (не глобальным дефолтом) — иначе кастомный
  // continueMarker разъедется с тем, что реально сохраняется в сообщении при клике «Дальше».
  let content = directive;
  if (!content) {
    const template = story.template ? await getNarratorTemplate(userId, story.template.id) : null;
    content = resolveNarratorMarkers(template).continueMarker;
  }

  return streamSSE(c, async (stream) => {
    let steerId: number | null = null;
    try {
      // Эфемерный user-ход как ребёнок последнего бита; курсор ставим на него (живой триггер).
      const steer = await insertStoryMessage(userId, storyId, parentBeatId, "user", kind, content);
      steerId = steer.id;
      await setActiveStoryMessage(storyId, steer.id);
      await stream.writeSSE({ event: "userMessage", data: JSON.stringify(steer) });

      // Авто-сжатие перед битом: если вход достиг лимита контекста — синхронно сжимаем (статус в ленте),
      // затем генерируем уже на освобождённом контексте. Сжатие — оптимизация: ни проверка, ни само
      // сжатие НЕ роняют advance (генерация продолжится со штатной обрезкой trimHistoryToBudget).
      const auto = await shouldAutoCompact(userId, storyId).catch((err) => {
        logger.warn({ err, userId, storyId }, "Auto-compaction check failed; skipping");
        return false;
      });
      if (auto) {
        await stream.writeSSE({ event: "status", data: JSON.stringify({ phase: "compacting" }) });
        await compactStory(userId, storyId).catch((err) =>
          logger.error({ err, userId, storyId }, "Auto-compaction failed; proceeding with trim"),
        );
      }

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

/**
 * POST /:id/messages/:msgId/translate — переводит бит/директиву и кэширует результат (зеркало RP).
 * body.force=true пропускает кэш и пересчитывает перевод текущим методом (перезаписывая его).
 * Метод (google/ai) берётся из storySettings.translateMethod, не из тела запроса.
 */
export async function handleStoryTranslateMessage(c: Ctx) {
  const user = c.get("tgUser");
  if (!user) return c.json({ error: "Auth required" }, 401);
  const userId = user.id;
  const storyId = Number(c.req.param("id"));
  const msgId = Number(c.req.param("msgId"));

  const body = (await c.req.json().catch(() => ({}))) as { targetLang?: string; force?: unknown };
  const targetLang = typeof body.targetLang === "string" ? body.targetLang.trim() : "";
  const force = body.force === true;
  if (!targetLang) return c.json({ error: "targetLang is required" }, 400);

  const t0 = Date.now();
  try {
    // Принадлежность проверяем через storyId→userId, затем сверяем, что сообщение из этой истории.
    const story = await getStory(userId, storyId);
    if (!story) return c.json({ error: "Story not found" }, 404);

    const msg = await getStoryMessage(userId, msgId);
    if (!msg || msg.storyChatId !== storyId) return c.json({ error: "Message not found" }, 404);

    // Кэш уже есть (translations расшифрованы в getStoryMessage) и пересчёт не запрошен —
    // не дёргаем переводчик повторно.
    const cached = (msg.translations as Record<string, string> | null)?.[targetLang];
    if (cached && !force) return c.json({ translation: cached });

    const { translateMethod } = await getStorySettings(storyId);
    let translation: string;
    if (translateMethod === "ai") {
      // Промпт перевода и рассуждение (включённость+эффорт) — из narrator-шаблона истории
      // (translationReasoningEffort — обязательное поле шаблона, не из пресета), см.
      // resolveTranslationReasoning.
      const template = story.template ? await getNarratorTemplate(userId, story.template.id) : null;
      const reasoning = resolveTranslationReasoning(template?.translationReasoningEffort);
      translation = await aiTranslate(
        template?.translationSystemPrompt ?? "",
        msg.content,
        englishLangName(targetLang),
        userId,
        reasoning.requestReasoning,
        reasoning.reasoningEffort,
      );
    } else {
      translation = await googleTranslate(msg.content, targetLang);
    }
    await saveStoryTranslation(userId, msgId, targetLang, translation);
    logger.info(
      { durationMs: Date.now() - t0, userId, storyId, msgId, targetLang, translateMethod },
      "Story message translated",
    );
    return c.json({ translation });
  } catch (err) {
    logger.error({ err, userId, storyId, msgId }, "Failed to translate story message");
    return c.json({ error: "Internal error" }, 500);
  }
}

/** DELETE /:id/messages/:msgId/translate?lang=xx — убирает закэшированный перевод для языка. */
export async function handleDeleteStoryTranslation(c: Ctx) {
  const user = c.get("tgUser");
  if (!user) return c.json({ error: "Auth required" }, 401);
  const userId = user.id;
  const storyId = Number(c.req.param("id"));
  const msgId = Number(c.req.param("msgId"));
  const targetLang = c.req.query("lang")?.trim() ?? "";
  if (!targetLang) return c.json({ error: "lang is required" }, 400);

  try {
    const story = await getStory(userId, storyId);
    if (!story) return c.json({ error: "Story not found" }, 404);

    const msg = await getStoryMessage(userId, msgId);
    if (!msg || msg.storyChatId !== storyId) return c.json({ error: "Message not found" }, 404);

    await deleteStoryTranslation(msgId, targetLang);
    return c.json({ ok: true });
  } catch (err) {
    logger.error({ err, userId, storyId, msgId }, "Failed to delete story translation");
    return c.json({ error: "Internal error" }, 500);
  }
}

/**
 * POST /:id/translate-text — перевод произвольного текста черновика (эфемерно, без кэша в БД).
 * mode: "google" (по умолчанию) или "ai" (запрос к LLM с промптом перевода из narrator-шаблона
 * истории). Используется шторой перевода черновика директивы. Зеркало handleTranslateText из RP,
 * но ИИ-промпт берётся из шаблона (не из пресета): шаблон — управляющая поверхность narrator.
 */
export async function handleStoryTranslateText(c: Ctx) {
  const user = c.get("tgUser");
  if (!user) return c.json({ error: "Auth required" }, 401);
  const userId = user.id;
  const storyId = Number(c.req.param("id"));

  const body = (await c.req.json().catch(() => ({}))) as {
    text?: string;
    targetLang?: string;
    mode?: string;
  };
  const text = typeof body.text === "string" ? body.text : "";
  const targetLang = typeof body.targetLang === "string" ? body.targetLang.trim() : "";
  const mode = body.mode === "ai" ? "ai" : "google";
  if (!text.trim() || !targetLang) return c.json({ error: "text and targetLang are required" }, 400);

  const t0 = Date.now();
  try {
    // Принадлежность истории пользователю.
    const story = await getStory(userId, storyId);
    if (!story) return c.json({ error: "Story not found" }, 404);

    let translation: string;
    if (mode === "ai") {
      // ИИ-режиму нужен промпт перевода из narrator-шаблона истории. Сэмплинг пресета НЕ
      // переиспользуем (как в RP): высокие temperature/penalties портят верность перевода.
      // Рассуждение (включённость+эффорт) — из обязательного поля шаблона translationReasoningEffort,
      // не из пресета, см. resolveTranslationReasoning.
      const template = story.template ? await getNarratorTemplate(userId, story.template.id) : null;
      const reasoning = resolveTranslationReasoning(template?.translationReasoningEffort);
      translation = await aiTranslate(
        template?.translationSystemPrompt ?? "",
        text,
        englishLangName(targetLang),
        userId,
        reasoning.requestReasoning,
        reasoning.reasoningEffort,
      );
    } else {
      translation = await googleTranslate(text, targetLang);
    }
    logger.info(
      { durationMs: Date.now() - t0, userId, storyId, targetLang, mode },
      "Story draft translated",
    );
    return c.json({ translation });
  } catch (err) {
    logger.error({ err, userId, storyId, targetLang, mode }, "Failed to translate story draft");
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
