import {
  deleteStoryTranslation,
  getStory,
  getStoryMessage,
  getStorySettings,
  saveStoryTranslation,
} from "../../db/stories/index.js";
import { getNarratorTemplate } from "../../db/narratorTemplates/index.js";
import logger from "../../logger.js";
import { chatCompletionErrorResponse } from "../shared/apiError.js";
import { englishLangName, googleTranslate, resolveTranslationReasoning } from "../shared/translate.js";
import { aiTranslateStoryText } from "./translateStoryText.js";
import type { Ctx } from "./stories.types.js";

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
      translation = await aiTranslateStoryText(
        msg.content,
        englishLangName(targetLang),
        userId,
        template ?? null,
        reasoning,
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
    return chatCompletionErrorResponse(c, err);
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
      translation = await aiTranslateStoryText(
        text,
        englishLangName(targetLang),
        userId,
        template ?? null,
        reasoning,
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
    return chatCompletionErrorResponse(c, err);
  }
}
