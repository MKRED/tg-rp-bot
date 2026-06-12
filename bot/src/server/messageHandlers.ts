import { streamSSE } from "hono/streaming";
import type { Context } from "hono";
import {
  deleteMessage,
  getChatSettings,
  getMessage,
  getChat,
  insertMessage,
  saveTranslation,
  updateActiveMessage,
} from "../db/chats.js";
import { getCharacter } from "../db/characters.js";
import { getPersona } from "../db/personas.js";
import { getPreset } from "../db/presets.js";
import { chatCompletion } from "../llm/client.js";
import logger from "../logger.js";
import type { AppVariables } from "./initData.js";
import { buildMessages, presetToCompletionOptions } from "./promptBuilder.js";
import { googleTranslate } from "./translate.js";

type Ctx = Context<{ Variables: AppVariables }>;

/**
 * Собирает ChatCompletionOptions для вызова LLM на основе текущего состояния чата.
 * Персонаж и пресет читаются из БД; если пресет не задан — используем пустой набор параметров.
 */
async function buildCompletionInput(
  userId: number,
  chatId: number,
  newUserMessage: string,
) {
  const chat = await getChat(userId, chatId);
  if (!chat) return null;

  const character = await getCharacter(userId, chat.character.id);
  if (!character) return null;

  const persona = chat.persona ? await getPersona(userId, chat.persona.id) : null;
  const preset = chat.preset ? await getPreset(userId, chat.preset.id) : null;

  const msgs = buildMessages({
    preset: preset ?? {
      id: 0, userId, name: "default",
      contextUnlimited: false, contextSize: null, maxTokens: null, streaming: false,
      temperature: null, topP: null, topK: null,
      frequencyPenalty: null, presencePenalty: null, repetitionPenalty: null,
      minP: null, topA: null,
      systemPrompt: "", auxiliarySystemPrompt: "", postHistoryInstruction: "", userPersonaPrompt: "",
      requestReasoning: false, reasoningEffort: null,
      promptOrder: [
        { id: "system", enabled: false },
        { id: "characterDescription", enabled: true },
        { id: "userDescription", enabled: false },
        { id: "auxiliary", enabled: false },
        { id: "history", enabled: true },
        { id: "postHistory", enabled: false },
      ],
      createdAt: new Date(), updatedAt: new Date(),
    },
    character: { name: character.name, prompt: character.prompt },
    persona: persona ? { name: persona.name, prompt: persona.prompt } : null,
    history: chat.messages,
    userMessage: newUserMessage,
  });

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
      const userMsg = await insertMessage(chatId, parentId, "user", content);
      await stream.writeSSE({ event: "userMessage", data: JSON.stringify(userMsg) });

      // Обновляем msgs с вставленным user-сообщением уже включённым (history уже содержит его через buildCompletionInput)
      let fullText = "";
      const result = await chatCompletion(
        { messages: msgs, ...samplingOpts },
        (token) => {
          fullText += token;
          // writeSSE внутри callback — fire and forget (не ждём promise)
          stream.writeSSE({ event: "token", data: JSON.stringify({ text: token }) }).catch(() => {});
        },
      );

      const assistantMsg = await insertMessage(chatId, userMsg.id, "assistant", result.content);
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

  const original = await getMessage(msgId);
  if (!original || original.chatId !== chatId) return c.json({ error: "Message not found" }, 404);

  if (original.role === "assistant") {
    // Просто создаём сиблинга и переключаемся на него
    const newMsg = await insertMessage(chatId, original.parentId, "assistant", content);
    await updateActiveMessage(chatId, newMsg.id);
    return c.json({ assistantMessage: newMsg });
  }

  // role="user": создаём нового user-сиблинга, потом перегенерируем ответ ИИ
  const newUserMsg = await insertMessage(chatId, original.parentId, "user", content);
  await updateActiveMessage(chatId, newUserMsg.id);

  const input = await buildCompletionInput(userId, chatId, content);
  if (!input) return c.json({ error: "Chat not found" }, 404);

  return streamSSE(c, async (stream) => {
    try {
      await stream.writeSSE({ event: "userMessage", data: JSON.stringify(newUserMsg) });

      const result = await chatCompletion(
        { messages: input.msgs, ...input.samplingOpts },
        (token) => {
          stream.writeSSE({ event: "token", data: JSON.stringify({ text: token }) }).catch(() => {});
        },
      );

      const assistantMsg = await insertMessage(chatId, newUserMsg.id, "assistant", result.content);
      await updateActiveMessage(chatId, assistantMsg.id);
      await stream.writeSSE({ event: "done", data: JSON.stringify(assistantMsg) });
    } catch (err) {
      logger.error({ err, userId, chatId }, "editMessage stream error");
      await stream.writeSSE({ event: "error", data: JSON.stringify({ message: "Generation failed" }) });
    }
  });
}

/** POST /:id/messages/:msgId/regenerate — генерирует новый ответ ИИ для родительского user-msg. */
export async function handleRegenerateMessage(c: Ctx) {
  const userId = c.get("tgUser")!.id;
  const chatId = Number(c.req.param("id"));
  const msgId = Number(c.req.param("msgId"));

  const original = await getMessage(msgId);
  if (!original || original.chatId !== chatId || original.role !== "assistant") {
    return c.json({ error: "Message not found or not an assistant message" }, 404);
  }

  // Получаем user-родителя для правильного контекста
  const parentUserMsg = original.parentId ? await getMessage(original.parentId) : null;
  if (!parentUserMsg) return c.json({ error: "Parent user message not found" }, 404);

  // Переключаемся на родительский user-msg, чтобы getChat вернул путь без старого ответа
  await updateActiveMessage(chatId, parentUserMsg.id);

  const input = await buildCompletionInput(userId, chatId, parentUserMsg.content);
  if (!input) return c.json({ error: "Chat not found" }, 404);

  return streamSSE(c, async (stream) => {
    try {
      const result = await chatCompletion(
        { messages: input.msgs, ...input.samplingOpts },
        (token) => {
          stream.writeSSE({ event: "token", data: JSON.stringify({ text: token }) }).catch(() => {});
        },
      );

      const newMsg = await insertMessage(chatId, parentUserMsg.id, "assistant", result.content);
      await updateActiveMessage(chatId, newMsg.id);
      await stream.writeSSE({ event: "done", data: JSON.stringify(newMsg) });
    } catch (err) {
      logger.error({ err, userId, chatId }, "regenerate stream error");
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

  const msg = await getMessage(msgId);
  if (!msg || msg.chatId !== chatId) return c.json({ error: "Message not found" }, 404);

  await updateActiveMessage(chatId, msgId);
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
  const deleted = await deleteMessage(chatId, msgId);
  if (!deleted) return c.json({ error: "Message not found" }, 404);

  logger.info({ durationMs: Date.now() - t0, userId, chatId, msgId }, "Message deleted via API");
  return c.json({ ok: true });
}

/** POST /:id/messages/:msgId/translate — переводит сообщение и кэширует результат. */
export async function handleTranslateMessage(c: Ctx) {
  const userId = c.get("tgUser")!.id;
  const chatId = Number(c.req.param("id"));
  const msgId = Number(c.req.param("msgId"));

  const body = (await c.req.json().catch(() => ({}))) as { targetLang?: string };
  const targetLang = typeof body.targetLang === "string" ? body.targetLang.trim() : "";
  if (!targetLang) return c.json({ error: "targetLang is required" }, 400);

  // Проверяем принадлежность через chatId→userId
  const chat = await getChat(userId, chatId);
  if (!chat) return c.json({ error: "Chat not found" }, 404);

  const msg = await getMessage(msgId);
  if (!msg || msg.chatId !== chatId) return c.json({ error: "Message not found" }, 404);

  // Если кэш уже есть — вернём без повторного запроса
  const cached = (msg.translations as Record<string, string> | null)?.[targetLang];
  if (cached) return c.json({ translation: cached });

  const translation = await googleTranslate(msg.content, targetLang);
  await saveTranslation(msgId, targetLang, translation);
  return c.json({ translation });
}
