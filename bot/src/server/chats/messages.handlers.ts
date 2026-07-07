import { streamSSE } from "hono/streaming";
import {
  deleteMessage,
  deleteTranslation,
  getChatSettings,
  getMessage,
  getChat,
  insertMessage,
  saveTranslation,
  setActiveMessage,
  updateActiveMessage,
} from "../../db/chats/index.js";
import { getCharacter } from "../../db/characters/index.js";
import { getPersona } from "../../db/personas/index.js";
import { getPreset } from "../../db/presets/index.js";
import logger from "../../logger.js";
import { buildMessages, makeDefaultPreset, presetToCompletionOptions } from "../prompt/promptBuilder.js";
import { streamCompletion } from "../shared/streamGeneration.js";
import { aiTranslate, englishLangName, googleTranslate } from "../shared/translate.js";
import type { ChatContext, Ctx } from "./chats.types.js";

/**
 * Загружает чат + связанные сущности (персонаж/персона/пресет) с проверкой владельца.
 * Возвращает null, если чат или персонаж не найдены. Переиспользуется обычной генерацией
 * и impersonate-хендлерами.
 */
export async function loadChatContext(
  userId: number,
  chatId: number,
): Promise<ChatContext | null> {
  const chat = await getChat(userId, chatId);
  if (!chat) return null;

  const character = await getCharacter(userId, chat.character.id);
  if (!character) return null;

  const persona = chat.persona ? await getPersona(userId, chat.persona.id) : null;
  const preset = chat.preset ? await getPreset(userId, chat.preset.id) : null;

  return { chat, character, persona, preset };
}

/**
 * Собирает ChatCompletionOptions для вызова LLM на основе текущего состояния чата.
 * Персонаж и пресет читаются из БД; если пресет не задан — используем пустой набор параметров.
 */
async function buildCompletionInput(
  userId: number,
  chatId: number,
  newUserMessage: string,
) {
  const ctx = await loadChatContext(userId, chatId);
  if (!ctx) return null;
  const { chat, character, persona, preset } = ctx;

  const msgs = buildMessages(
    {
      preset: preset ?? makeDefaultPreset(userId),
      character: { name: character.name, prompt: character.prompt, scenario: character.scenario },
      persona: persona ? { name: persona.name, prompt: persona.prompt } : null,
      history: chat.messages,
      userMessage: newUserMessage,
    },
    {
      // История урезана под contextSize пресета — фиксируем в логах, сколько старых реплик
      // выпало из контекста (отброшено самых старых: kept из total).
      onTrim: ({ dropped, kept, total }) =>
        logger.info({ userId, chatId, dropped, kept, total }, "History trimmed to context budget"),
    },
  );

  const samplingOpts = preset ? presetToCompletionOptions(preset) : {};
  return { msgs, samplingOpts, chat };
}

/** POST /:id/messages — отправить сообщение и стримить ответ ИИ. */
export async function handleSendMessage(c: Ctx) {
  const userId = c.get("tgUser")!.id;
  const chatId = Number(c.req.param("id"));

  const body = (await c.req.json().catch(() => ({}))) as { content?: string };
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return c.json({ error: "content is required" }, 400);

  const input = await buildCompletionInput(userId, chatId, content);
  if (!input) return c.json({ error: "Chat not found" }, 404);

  const { msgs, samplingOpts, chat } = input;
  const parentId = chat.activeMessageId;

  return streamSSE(c, async (stream) => {
    try {
      // Вставляем user-сообщение и сразу отдаём клиенту
      const userMsg = await insertMessage(userId, chatId, parentId, "user", content);
      await stream.writeSSE({ event: "userMessage", data: JSON.stringify(userMsg) });

      // history уже содержит вставленное user-сообщение (через buildCompletionInput)
      const result = await streamCompletion(stream, {
        messages: msgs,
        ...samplingOpts,
        userId,
        debugLabel: "rp",
      });

      const assistantMsg = await insertMessage(userId, chatId, userMsg.id, "assistant", result.content);
      await updateActiveMessage(chatId, assistantMsg.id);
      await stream.writeSSE({ event: "done", data: JSON.stringify(assistantMsg) });
    } catch (err) {
      logger.error({ err, userId, chatId }, "sendMessage stream error");
      await stream.writeSSE({ event: "error", data: JSON.stringify({ message: "Generation failed" }) });
    }
  });
}

/** POST /:id/messages/:msgId/edit — редактирует сообщение, создавая сиблинга. */
export async function handleEditMessage(c: Ctx) {
  const userId = c.get("tgUser")!.id;
  const chatId = Number(c.req.param("id"));
  const msgId = Number(c.req.param("msgId"));

  const body = (await c.req.json().catch(() => ({}))) as { content?: string };
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return c.json({ error: "content is required" }, 400);

  const original = await getMessage(userId, msgId);
  if (!original || original.chatId !== chatId) return c.json({ error: "Message not found" }, 404);

  if (original.role === "assistant") {
    // Создаём сиблинга и возвращаем через SSE — клиент ожидает event:done, не JSON
    const newMsg = await insertMessage(userId, chatId, original.parentId, "assistant", content);
    await updateActiveMessage(chatId, newMsg.id);
    return streamSSE(c, async (stream) => {
      await stream.writeSSE({ event: "done", data: JSON.stringify(newMsg) });
    });
  }

  // role="user": создаём нового user-сиблинга, потом перегенерируем ответ ИИ
  const newUserMsg = await insertMessage(userId, chatId, original.parentId, "user", content);
  // Курсор — на сообщение ПЕРЕД user-репликой (её родителя), а текст передаём как userMessage:
  // иначе history закончилась бы на newUserMsg, и buildMessages добавил бы её content повторно
  // (дубль user-реплики). Та же схема, что в handleSendMessage/handleRegenerateMessage.
  await setActiveMessage(chatId, original.parentId);

  const input = await buildCompletionInput(userId, chatId, content);
  if (!input) return c.json({ error: "Chat not found" }, 404);

  return streamSSE(c, async (stream) => {
    try {
      await stream.writeSSE({ event: "userMessage", data: JSON.stringify(newUserMsg) });

      const result = await streamCompletion(stream, {
        messages: input.msgs,
        ...input.samplingOpts,
        userId,
        debugLabel: "rp",
      });

      const assistantMsg = await insertMessage(userId, chatId, newUserMsg.id, "assistant", result.content);
      await updateActiveMessage(chatId, assistantMsg.id);
      await stream.writeSSE({ event: "done", data: JSON.stringify(assistantMsg) });
    } catch (err) {
      logger.error({ err, userId, chatId }, "editMessage stream error");
      // Возвращаем курсор на новую user-реплику (выше неё мы поднимали его лишь ради контекста).
      await updateActiveMessage(chatId, newUserMsg.id).catch(() => {});
      await stream.writeSSE({ event: "error", data: JSON.stringify({ message: "Generation failed" }) });
    }
  });
}

/** POST /:id/messages/:msgId/regenerate — генерирует новый ответ ИИ.
 *  Принимает ID assistant-сообщения (перегенерация) или user-сообщения (первый ответ на него). */
export async function handleRegenerateMessage(c: Ctx) {
  const userId = c.get("tgUser")!.id;
  const chatId = Number(c.req.param("id"));
  const msgId = Number(c.req.param("msgId"));

  const original = await getMessage(userId, msgId);
  if (!original || original.chatId !== chatId) {
    return c.json({ error: "Message not found" }, 404);
  }

  // Если передан user-msg — отвечаем на него напрямую;
  // если assistant-msg — берём его родительский user-msg (перегенерация).
  const parentUserMsg =
    original.role === "user"
      ? original
      : original.parentId
        ? await getMessage(userId, original.parentId)
        : null;
  if (!parentUserMsg) return c.json({ error: "Parent user message not found" }, 404);

  // Курсор ставим на сообщение ПЕРЕД user-репликой (её родителя), а саму реплику передаём
  // как userMessage — повторяя схему handleSendMessage. Так getChat вернёт историю без старого
  // ответа (иначе findLeaf спустился бы обратно к нему) и без дубля самой user-реплики.
  await setActiveMessage(chatId, parentUserMsg.parentId);

  const input = await buildCompletionInput(userId, chatId, parentUserMsg.content);
  if (!input) return c.json({ error: "Chat not found" }, 404);

  return streamSSE(c, async (stream) => {
    try {
      const result = await streamCompletion(stream, {
        messages: input.msgs,
        ...input.samplingOpts,
        userId,
        debugLabel: "rp",
      });

      const newMsg = await insertMessage(userId, chatId, parentUserMsg.id, "assistant", result.content);
      await updateActiveMessage(chatId, newMsg.id);
      await stream.writeSSE({ event: "done", data: JSON.stringify(newMsg) });
    } catch (err) {
      logger.error({ err, userId, chatId }, "regenerate stream error");
      // Возвращаем курсор на существующий ответ, чтобы чат не «откатился» к точке до реплики
      // (мы временно подняли его выше user-реплики ради построения контекста).
      await updateActiveMessage(chatId, parentUserMsg.id).catch(() => {});
      await stream.writeSSE({ event: "error", data: JSON.stringify({ message: "Generation failed" }) });
    }
  });
}

/** POST /:id/messages/:msgId/branch — переключает активную ветку (устанавливает курсор). */
export async function handleSwitchBranch(c: Ctx) {
  const userId = c.get("tgUser")!.id;
  const chatId = Number(c.req.param("id"));
  const msgId = Number(c.req.param("msgId"));

  // Проверяем принадлежность чата пользователю
  const chat = await getChat(userId, chatId);
  if (!chat) return c.json({ error: "Chat not found" }, 404);

  const msg = await getMessage(userId, msgId);
  if (!msg || msg.chatId !== chatId) return c.json({ error: "Message not found" }, 404);

  // Ставим курсор ровно на выбранный узел (без спуска к листу): клик в графе по
  // узлу в середине дерева фиксирует диалог на нём — можно ответвиться отсюда.
  await setActiveMessage(chatId, msgId);
  return c.json({ ok: true });
}

/** DELETE /:id/messages/:msgId — удаляет сообщение и всё его поддерево. */
export async function handleDeleteMessage(c: Ctx) {
  const userId = c.get("tgUser")!.id;
  const chatId = Number(c.req.param("id"));
  const msgId = Number(c.req.param("msgId"));

  // Проверяем принадлежность чата пользователю
  const chat = await getChat(userId, chatId);
  if (!chat) return c.json({ error: "Chat not found" }, 404);

  const t0 = Date.now();
  const deleted = await deleteMessage(userId, chatId, msgId);
  if (!deleted) return c.json({ error: "Message not found" }, 404);

  logger.info({ durationMs: Date.now() - t0, userId, chatId, msgId }, "Message deleted via API");
  return c.json({ ok: true });
}

/**
 * POST /:id/messages/:msgId/translate — переводит сообщение и кэширует результат.
 * body.force=true пропускает кэш и пересчитывает перевод текущим методом (перезаписывая его) —
 * нужно для кнопки «Перевести заново» и при смене метода перевода в настройках.
 * Метод (google/ai) берётся из chatSettings.translateMethod, не из тела запроса.
 */
export async function handleTranslateMessage(c: Ctx) {
  const userId = c.get("tgUser")!.id;
  const chatId = Number(c.req.param("id"));
  const msgId = Number(c.req.param("msgId"));

  const body = (await c.req.json().catch(() => ({}))) as { targetLang?: string; force?: unknown };
  const targetLang = typeof body.targetLang === "string" ? body.targetLang.trim() : "";
  const force = body.force === true;
  if (!targetLang) return c.json({ error: "targetLang is required" }, 400);

  try {
    // Проверяем принадлежность через chatId→userId
    const chat = await getChat(userId, chatId);
    if (!chat) return c.json({ error: "Chat not found" }, 404);

    const msg = await getMessage(userId, msgId);
    if (!msg || msg.chatId !== chatId) return c.json({ error: "Message not found" }, 404);

    // Если кэш уже есть и не запрошен пересчёт — вернём без повторного запроса
    // (translations расшифрованы в getMessage).
    const cached = (msg.translations as Record<string, string> | null)?.[targetLang];
    if (cached && !force) return c.json({ translation: cached });

    const { translateMethod } = await getChatSettings(chatId);
    let translation: string;
    if (translateMethod === "ai") {
      // Промпт перевода — из пресета чата (управляющая поверхность ИИ-режима), сэмплинг не переиспользуем
      // (см. handleTranslateText/aiTranslate — параметры RP испортили бы верность перевода).
      const preset = chat.preset ? await getPreset(userId, chat.preset.id) : null;
      translation = await aiTranslate(
        preset?.translationSystemPrompt ?? "",
        msg.content,
        englishLangName(targetLang),
        userId,
        preset?.reasoningEffort,
      );
    } else {
      translation = await googleTranslate(msg.content, targetLang);
    }
    await saveTranslation(userId, msgId, targetLang, translation);
    return c.json({ translation });
  } catch (err) {
    logger.error({ err, userId, chatId, msgId }, "Failed to translate message");
    return c.json({ error: "Internal error" }, 500);
  }
}

/** DELETE /:id/messages/:msgId/translate?lang=xx — убирает закэшированный перевод для языка. */
export async function handleDeleteTranslation(c: Ctx) {
  const userId = c.get("tgUser")!.id;
  const chatId = Number(c.req.param("id"));
  const msgId = Number(c.req.param("msgId"));
  const targetLang = c.req.query("lang")?.trim() ?? "";
  if (!targetLang) return c.json({ error: "lang is required" }, 400);

  try {
    const chat = await getChat(userId, chatId);
    if (!chat) return c.json({ error: "Chat not found" }, 404);

    const msg = await getMessage(userId, msgId);
    if (!msg || msg.chatId !== chatId) return c.json({ error: "Message not found" }, 404);

    await deleteTranslation(msgId, targetLang);
    return c.json({ ok: true });
  } catch (err) {
    logger.error({ err, userId, chatId, msgId }, "Failed to delete translation");
    return c.json({ error: "Internal error" }, 500);
  }
}
