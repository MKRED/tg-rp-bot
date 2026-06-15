import { streamSSE } from "hono/streaming";
import type { Context } from "hono";
import { getChat } from "../db/chats.js";
import { deleteVariant, insertVariant, listVariants } from "../db/impersonations.js";
import { chatCompletion } from "../llm/client.js";
import logger from "../logger.js";
import type { AppVariables } from "./initData.js";
import { loadChatContext } from "./messageHandlers.js";
import { presetToCompletionOptions, renderImpersonateMessages } from "./promptBuilder.js";
import { googleTranslate } from "./translate.js";

type Ctx = Context<{ Variables: AppVariables }>;

/**
 * POST /:id/impersonate — генерирует один вариант реплики от лица пользователя и стримит его.
 * Запрос = 2 сообщения (system-шаблон + плоская история), см. renderImpersonateMessages.
 * Стриминг токенов включается флагом пресета userPersonaStreaming (выкл → клиент покажет спиннер).
 * Готовый вариант сохраняется в БД (FIFO, ≤20 на момент = chat.activeMessageId).
 */
export async function handleImpersonate(c: Ctx) {
  const userId = c.get("tgUser")!.id;
  const chatId = Number(c.req.param("id"));

  const ctx = await loadChatContext(userId, chatId);
  if (!ctx) return c.json({ error: "Chat not found" }, 404);
  const { chat, character, persona, preset } = ctx;

  const messages = renderImpersonateMessages({
    template: preset?.userPersonaPrompt ?? "",
    character: { name: character.name, prompt: character.prompt },
    persona: persona ? { name: persona.name, prompt: persona.prompt } : null,
    systemPrompt: preset?.systemPrompt ?? "",
    auxPrompt: preset?.auxiliarySystemPrompt ?? "",
    history: chat.messages,
  });
  const samplingOpts = preset ? presetToCompletionOptions(preset) : {};
  const doStream = preset?.userPersonaStreaming ?? true;
  const parentMessageId = chat.activeMessageId;

  return streamSSE(c, async (stream) => {
    try {
      const t0 = Date.now();
      const result = await chatCompletion(
        { messages, ...samplingOpts },
        doStream
          ? (token) => {
              // fire-and-forget внутри callback — не ждём промис
              stream
                .writeSSE({ event: "token", data: JSON.stringify({ text: token }) })
                .catch(() => {});
            }
          : undefined,
        // Перед ретраем пустого/отказного варианта — просим клиента стереть показанный текст.
        doStream
          ? () => stream.writeSSE({ event: "reset", data: "{}" }).catch(() => {})
          : undefined,
      );

      const variant = await insertVariant(userId, chatId, parentMessageId, result.content);
      logger.info(
        { durationMs: Date.now() - t0, userId, chatId, streamed: doStream },
        "Impersonate variant generated",
      );
      await stream.writeSSE({ event: "done", data: JSON.stringify({ variant }) });
    } catch (err) {
      logger.error({ err, userId, chatId }, "impersonate stream error");
      await stream.writeSSE({ event: "error", data: JSON.stringify({ message: "Generation failed" }) });
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

/** POST /:id/translate-text — перевод произвольного текста (эфемерно, без кэша в БД). */
export async function handleTranslateText(c: Ctx) {
  const userId = c.get("tgUser")!.id;
  const chatId = Number(c.req.param("id"));

  const body = (await c.req.json().catch(() => ({}))) as { text?: string; targetLang?: string };
  const text = typeof body.text === "string" ? body.text : "";
  const targetLang = typeof body.targetLang === "string" ? body.targetLang.trim() : "";
  if (!text.trim() || !targetLang) return c.json({ error: "text and targetLang are required" }, 400);

  // Проверяем принадлежность чата пользователю
  const chat = await getChat(userId, chatId);
  if (!chat) return c.json({ error: "Chat not found" }, 404);

  const translation = await googleTranslate(text, targetLang);
  return c.json({ translation });
}
