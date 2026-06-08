import { config } from "../config.js";
import logger from "../logger.js";
import { retry } from "../utils/index.js";
import { CHAT_COMPLETIONS_PATH, OPENROUTER_APP_HEADERS, OPENROUTER_BASE_URL } from "./constants.js";
import type { ChatCompletionOptions, ChatCompletionResult, OpenRouterResponse } from "./types.js";

/** Ошибка с HTTP-статусом OpenRouter — по статусу решаем, ретраить ли. */
class OpenRouterHttpError extends Error {
  constructor(
    readonly status: number,
    readonly bodyText: string,
  ) {
    super(`OpenRouter ${status}: ${bodyText}`);
    this.name = "OpenRouterHttpError";
  }
}

/**
 * Вызывает OpenRouter chat completion и возвращает текст ответа + расход токенов.
 *
 * Запрос идёт обычным fetch без undici-dispatcher, поэтому НЕ проходит через
 * Telegram-прокси (требование: через прокси только Telegram).
 */
export async function chatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
  // Ключ проверяем в момент вызова, а не на старте бота — чтобы бот поднимался без OpenRouter.
  if (!config.openRouterApiKey) {
    throw new Error("OPENROUTER_API_KEY is not set — cannot call OpenRouter");
  }

  const model = options.model ?? config.openRouterModel;
  const url = `${OPENROUTER_BASE_URL}${CHAT_COMPLETIONS_PATH}`;
  const t0 = Date.now();

  logger.debug({ model, messages: options.messages.length }, "OpenRouter chat completion start");

  const data = await retry<OpenRouterResponse>(
    async () => {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.openRouterApiKey}`,
          "Content-Type": "application/json",
          ...OPENROUTER_APP_HEADERS,
        },
        body: JSON.stringify({
          model,
          messages: options.messages,
          temperature: options.temperature,
          max_tokens: options.maxTokens,
        }),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new OpenRouterHttpError(response.status, text);
      }
      return (await response.json()) as OpenRouterResponse;
    },
    3,
    1500,
    "openrouter.chatCompletion",
    // Ретраим сетевые сбои и 5xx/429; обычные 4xx (неверный запрос/ключ) — нет.
    (err) => (err instanceof OpenRouterHttpError ? err.status >= 500 || err.status === 429 : true),
  );

  const result: ChatCompletionResult = {
    content: data.choices[0]?.message.content ?? "",
    model: data.model,
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }
      : undefined,
  };

  logger.info(
    { durationMs: Date.now() - t0, model: result.model, ...result.usage },
    "OpenRouter chat completion done",
  );
  return result;
}
