import { streamSSE } from "hono/streaming";
import { getChat } from "../../db/chats/index.js";
import {
  deleteAllVariantsForChat,
  deleteVariant,
  insertVariant,
  listVariants,
} from "../../db/impersonations/index.js";
import logger from "../../logger.js";
import { presetToCompletionOptions, renderImpersonateMessages } from "../prompt/promptBuilder/index.js";
import { chatCompletionErrorResponse } from "../shared/apiError.js";
import { streamCompletion, writeGenerationError } from "../shared/streamGeneration.js";
import { aiTranslate, englishLangName, googleTranslate } from "../shared/translate.js";
import { loadChatContext } from "./messages.handlers.js";
import type { Ctx } from "./chats.types.js";

/**
 * POST /:id/impersonate — генерирует один вариант реплики от лица пользователя и стримит его.
 * Запрос = 2 сообщения (system-шаблон + плоская история), см. renderImpersonateMessages.
 * Стриминг токенов включается флагом RP-шаблона userPersonaStreaming (выкл → клиент покажет спиннер).
 * Готовый вариант сохраняется в БД (FIFO, ≤20 на момент = chat.activeMessageId).
 */
export async function handleImpersonate(c: Ctx) {
  const userId = c.get("tgUser")!.id;
  const chatId = Number(c.req.param("id"));

  const ctx = await loadChatContext(userId, chatId);
  if (!ctx) return c.json({ error: "Chat not found" }, 404);
  const { chat, character, persona, template, preset } = ctx;

  const messages = renderImpersonateMessages({
    template: template?.userPersonaPrompt ?? "",
    character: { name: character.name, prompt: character.prompt, scenario: character.scenario },
    persona: persona ? { name: persona.name, prompt: persona.prompt } : null,
    systemPrompt: template?.systemPrompt ?? "",
    auxPrompt: template?.auxiliarySystemPrompt ?? "",
    history: chat.messages,
    // Лимит контекста урезает историю так же, как в обычной генерации (см. resolveImpersonateHistory).
    contextUnlimited: preset?.contextUnlimited,
    contextSize: preset?.contextSize,
    maxTokens: preset?.maxTokens,
    onTrim: ({ dropped, kept, total }) =>
      logger.info({ userId, chatId, dropped, kept, total }, "Impersonate history trimmed to context budget"),
  });
  const samplingOpts = preset ? presetToCompletionOptions(preset) : {};
  const doStream = template?.userPersonaStreaming ?? true;
  const parentMessageId = chat.activeMessageId;

  return streamSSE(c, async (stream) => {
    try {
      const t0 = Date.now();
      const result = await streamCompletion(
        stream,
        { messages, ...samplingOpts, userId, debugLabel: "impersonate" },
        doStream,
      );

      const variant = await insertVariant(userId, chatId, parentMessageId, result.content);
      logger.info(
        { durationMs: Date.now() - t0, userId, chatId, streamed: doStream },
        "Impersonate variant generated",
      );
      await stream.writeSSE({ event: "done", data: JSON.stringify({ variant }) });
    } catch (err) {
      logger.error({ err, userId, chatId }, "impersonate stream error");
      await writeGenerationError(stream, err);
    }
  });
}

/** GET /:id/impersonate — список вариантов для текущего момента (chat.activeMessageId). */
export async function handleListImpersonations(c: Ctx) {
  const userId = c.get("tgUser")!.id;
  const chatId = Number(c.req.param("id"));

  const chat = await getChat(userId, chatId);
  if (!chat) return c.json({ error: "Chat not found" }, 404);

  const variants = await listVariants(userId, chatId, chat.activeMessageId);
  return c.json({ variants });
}

/** DELETE /:id/impersonate — очистить ВСЕ сохранённые варианты реплик чата. */
export async function handleClearImpersonations(c: Ctx) {
  const userId = c.get("tgUser")!.id;
  const chatId = Number(c.req.param("id"));

  // Проверяем принадлежность чата пользователю до массового удаления
  const chat = await getChat(userId, chatId);
  if (!chat) return c.json({ error: "Chat not found" }, 404);

  const deleted = await deleteAllVariantsForChat(chatId);
  return c.json({ ok: true, deleted });
}

/** DELETE /:id/impersonate/:variantId — удалить один сохранённый вариант реплики. */
export async function handleDeleteImpersonation(c: Ctx) {
  const userId = c.get("tgUser")!.id;
  const chatId = Number(c.req.param("id"));
  const variantId = Number(c.req.param("variantId"));

  // Проверяем принадлежность чата пользователю до удаления варианта
  const chat = await getChat(userId, chatId);
  if (!chat) return c.json({ error: "Chat not found" }, 404);

  const deleted = await deleteVariant(chatId, variantId);
  if (!deleted) return c.json({ error: "Variant not found" }, 404);
  return c.json({ ok: true });
}

/**
 * POST /:id/translate-text — перевод произвольного текста (эфемерно, без кэша в БД).
 * mode: "google" (по умолчанию — Google Translate) или "ai" (запрос к LLM с промптом перевода
 * из RP-шаблона). Используется и карточками impersonate (без mode → google), и шторой перевода черновика.
 */
export async function handleTranslateText(c: Ctx) {
  const userId = c.get("tgUser")!.id;
  const chatId = Number(c.req.param("id"));

  const body = (await c.req.json().catch(() => ({}))) as {
    text?: string;
    targetLang?: string;
    mode?: string;
  };
  const text = typeof body.text === "string" ? body.text : "";
  const targetLang = typeof body.targetLang === "string" ? body.targetLang.trim() : "";
  const mode = body.mode === "ai" ? "ai" : "google";
  if (!text.trim() || !targetLang) return c.json({ error: "text and targetLang are required" }, 400);

  if (mode === "ai") {
    // ИИ-режиму нужны RP-шаблон и пресет чата (проверка владельца — внутри loadChatContext).
    const ctx = await loadChatContext(userId, chatId);
    if (!ctx) return c.json({ error: "Chat not found" }, 404);
    const { template, preset } = ctx;
    try {
      // Сэмплинг пресета НЕ переиспользуем: его maxTokens обрезал бы длинный перевод, а высокие
      // temperature/penalties (настроенные под RP) портят верность перевода. Управляющая
      // поверхность ИИ-режима — промпт перевода из RP-шаблона; параметры оставляем дефолтными.
      const translation = await aiTranslate(
        template?.translationSystemPrompt ?? "",
        text,
        englishLangName(targetLang),
        userId,
        true,
        preset?.reasoningEffort,
      );
      return c.json({ translation });
    } catch (err) {
      logger.error({ err, userId, chatId }, "Failed to translate draft text");
      return chatCompletionErrorResponse(c, err);
    }
  }

  // Проверяем принадлежность чата пользователю
  const chat = await getChat(userId, chatId);
  if (!chat) return c.json({ error: "Chat not found" }, 404);

  const translation = await googleTranslate(text, targetLang);
  return c.json({ translation });
}
