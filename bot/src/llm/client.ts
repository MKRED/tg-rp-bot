import { config } from "../config.js";
import logger from "../logger.js";
import { retry } from "../utils/index.js";
import { isUnusableCompletion } from "./completionGuard.js";
import { CHAT_COMPLETIONS_PATH, OPENROUTER_APP_HEADERS, OPENROUTER_BASE_URL } from "./constants.js";
import type {
  ChatCompletionOptions,
  ChatCompletionResult,
  OpenRouterResponse,
  OpenRouterStreamDelta,
} from "./types.js";

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

/** Ответ пришёл, но непригоден (пустой текст или отказ модели) — ретраибл. */
class EmptyCompletionError extends Error {
  constructor() {
    super("OpenRouter returned an empty or refusal completion");
    this.name = "EmptyCompletionError";
  }
}

function buildBody(options: ChatCompletionOptions, stream: boolean): Record<string, unknown> {
  return {
    model: options.model ?? config.openRouterModel,
    messages: options.messages,
    stream,
    // Передаём только заданные параметры — OpenRouter применяет дефолты на undefined.
    ...(options.temperature !== undefined && { temperature: options.temperature }),
    ...(options.maxTokens !== undefined && { max_tokens: options.maxTokens }),
    ...(options.topP !== undefined && { top_p: options.topP }),
    ...(options.topK !== undefined && { top_k: options.topK }),
    ...(options.frequencyPenalty !== undefined && { frequency_penalty: options.frequencyPenalty }),
    ...(options.presencePenalty !== undefined && { presence_penalty: options.presencePenalty }),
    ...(options.repetitionPenalty !== undefined && { repetition_penalty: options.repetitionPenalty }),
    ...(options.minP !== undefined && { min_p: options.minP }),
    ...(options.topA !== undefined && { top_a: options.topA }),
  };
}

function makeHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${config.openRouterApiKey}`,
    "Content-Type": "application/json",
    ...OPENROUTER_APP_HEADERS,
  };
}

/**
 * Вызывает OpenRouter chat completion.
 *
 * Если передан `onChunk` — использует streaming (Server-Sent Events): каждый токен
 * передаётся в коллбэк, итоговая строка накапливается и возвращается как обычно.
 * Без `onChunk` — обычный single-shot запрос.
 *
 * Запрос идёт обычным fetch без undici-dispatcher, поэтому НЕ проходит через
 * Telegram-прокси (требование: через прокси только Telegram).
 */
export async function chatCompletion(
  options: ChatCompletionOptions,
  onChunk?: (token: string) => void,
  onReset?: () => void,
): Promise<ChatCompletionResult> {
  if (!config.openRouterApiKey) {
    throw new Error("OPENROUTER_API_KEY is not set — cannot call OpenRouter");
  }

  const model = options.model ?? config.openRouterModel;
  const url = `${OPENROUTER_BASE_URL}${CHAT_COMPLETIONS_PATH}`;
  const t0 = Date.now();

  logger.debug(
    { model, messages: options.messages.length, streaming: !!onChunk },
    "OpenRouter chat completion start",
  );

  if (onChunk) {
    return chatCompletionStreaming(options, model, url, t0, onChunk, onReset);
  }

  // Непригодный ответ (пустой/отказ) бросает EmptyCompletionError внутри retry — попытка
  // повторяется так же, как при 5xx/429.
  const data = await retry<OpenRouterResponse>(
    async () => {
      const response = await fetch(url, {
        method: "POST",
        headers: makeHeaders(),
        body: JSON.stringify(buildBody(options, false)),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new OpenRouterHttpError(response.status, text);
      }
      const json = (await response.json()) as OpenRouterResponse;
      if (isUnusableCompletion(json.choices[0]?.message.content ?? "")) {
        throw new EmptyCompletionError();
      }
      return json;
    },
    3,
    1500,
    "openrouter.chatCompletion",
    (err) =>
      err instanceof EmptyCompletionError ||
      (err instanceof OpenRouterHttpError ? err.status >= 500 || err.status === 429 : true),
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

/**
 * Streaming-ветка: одну попытку оборачиваем в retry. Непригодный результат (пустой/отказ)
 * бросает EmptyCompletionError и регенерируется заново; перед этим зовём onReset, чтобы
 * клиент стёр уже показанный (плохой) текст и не склеил его со следующей попыткой.
 * Сетевые ошибки до начала чтения тела тоже ретраятся (как в non-stream).
 */
async function chatCompletionStreaming(
  options: ChatCompletionOptions,
  model: string,
  url: string,
  t0: number,
  onChunk: (token: string) => void,
  onReset?: () => void,
): Promise<ChatCompletionResult> {
  return retry<ChatCompletionResult>(
    async () => {
      const result = await streamOnce(options, model, url, onChunk);
      if (isUnusableCompletion(result.content)) {
        // Стёрли плохой ответ у клиента прямо сейчас (а не после backoff-задержки).
        onReset?.();
        throw new EmptyCompletionError();
      }
      logger.info(
        { durationMs: Date.now() - t0, model: result.model, chars: result.content.length },
        "OpenRouter streaming completion done",
      );
      return result;
    },
    3,
    1500,
    "openrouter.chatCompletion.stream",
    (err) =>
      err instanceof EmptyCompletionError ||
      (err instanceof OpenRouterHttpError ? err.status >= 500 || err.status === 429 : true),
  );
}

/** Одна попытка стриминга: fetch + чтение SSE-потока, onChunk на каждый токен. */
async function streamOnce(
  options: ChatCompletionOptions,
  model: string,
  url: string,
  onChunk: (token: string) => void,
): Promise<ChatCompletionResult> {
  const response = await fetch(url, {
    method: "POST",
    headers: makeHeaders(),
    body: JSON.stringify(buildBody(options, true)),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new OpenRouterHttpError(response.status, text);
  }

  if (!response.body) {
    throw new Error("OpenRouter streaming: response.body is null");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";
  let responseModel = model;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Разбиваем на строки; последняя (возможно неполная) остаётся в буфере.
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (raw === "[DONE]") continue;
        let parsed: OpenRouterStreamDelta;
        try {
          parsed = JSON.parse(raw) as OpenRouterStreamDelta;
        } catch {
          continue;
        }
        if (parsed.model) responseModel = parsed.model;
        const delta = parsed.choices[0]?.delta?.content;
        if (delta) {
          fullContent += delta;
          onChunk(delta);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return { content: fullContent, model: responseModel };
}
