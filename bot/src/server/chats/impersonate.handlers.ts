import { streamSSE } from "hono/streaming";
import { insertVariant } from "../../db/impersonations/index.js";
import logger from "../../logger.js";
import { presetToCompletionOptions, renderImpersonateMessages } from "../../prompt/promptBuilder/index.js";
import { streamCompletion, writeGenerationError } from "../../common/stream-completion.js";
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
