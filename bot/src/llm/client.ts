import logger from "../logger.js";
import { retry } from "../utils/index.js";
import { isUnusableCompletion } from "./completionGuard.js";
import { CHAT_COMPLETIONS_PATH } from "./constants.js";
import { type LlmDebugResponse, recordLlmCall } from "./debugCapture.js";
import { EmptyCompletionError, LlmHttpError } from "./errors.js";
import { getActiveProvider, type LlmProvider } from "./providers.js";
import { buildBody, makeHeaders } from "./request.js";
import type {
  ChatCompletionOptions,
  ChatCompletionResult,
  LlmResponse,
  LlmStreamDelta,
} from "./types.js";

/**
 * Вызывает chat completion активного LLM-провайдера (OpenRouter или DeepSeek — выбор по
 * config.llmProvider). Оба OpenAI-совместимы, поэтому код общий, различия — в providers.ts.
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
  const provider = getActiveProvider();
  if (!provider.apiKey) {
    throw new Error(`API key for LLM provider "${provider.name}" is not set — cannot call LLM`);
  }

  const model = options.model ?? provider.defaultModel;
  const url = `${provider.baseUrl}${CHAT_COMPLETIONS_PATH}`;
  const t0 = Date.now();

  logger.debug(
    { provider: provider.name, model, messages: options.messages.length, streaming: !!onChunk },
    "LLM chat completion start",
  );

  // Перехватываем КАЖДЫЙ вызов (для отладочного экрана) один раз, оборачивая обе ветки —
  // и stream, и single. Запись делаем в finally, чтобы поймать и ошибки (4xx/5xx, пустой/отказной
  // ответ): именно они ценнее всего для отладки «где что не так».
  const streaming = !!onChunk;
  let response: LlmDebugResponse = { ok: false };
  try {
    // Тестируем onChunk (а не streaming) — так TS сужает его до определённого в stream-ветке.
    const result = onChunk
      ? await chatCompletionStreaming(options, provider, model, url, t0, onChunk, onReset)
      : await chatCompletionSingle(options, provider, model, url, t0);
    response = { ok: true, content: result.content, model: result.model, usage: result.usage };
    return result;
  } catch (err) {
    response = {
      ok: false,
      status: err instanceof LlmHttpError ? err.status : undefined,
      error: err instanceof Error ? err.message : String(err),
    };
    throw err;
  } finally {
    // buildBody детерминирован из options → снимок RAW-тела пересобираем здесь (а не ловим
    // точную строку внутри retry, иначе на 3 попытки было бы 3 записи).
    recordLlmCall({
      at: new Date().toISOString(),
      userId: options.userId ?? null,
      label: options.debugLabel ?? "other",
      provider: provider.name,
      model,
      streaming,
      durationMs: Date.now() - t0,
      request: buildBody(options, streaming, provider),
      response,
    });
  }
}

/**
 * Одна non-stream генерация, обёрнутая в retry. Непригодный ответ (пустой/отказ) бросает
 * EmptyCompletionError — попытка повторяется так же, как при 5xx/429.
 */
async function chatCompletionSingle(
  options: ChatCompletionOptions,
  provider: LlmProvider,
  model: string,
  url: string,
  t0: number,
): Promise<ChatCompletionResult> {
  const data = await retry<LlmResponse>(
    async () => {
      const response = await fetch(url, {
        method: "POST",
        headers: makeHeaders(provider),
        body: JSON.stringify(buildBody(options, false, provider)),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new LlmHttpError(provider.name, response.status, text);
      }
      const json = (await response.json()) as LlmResponse;
      if (isUnusableCompletion(json.choices[0]?.message.content ?? "")) {
        throw new EmptyCompletionError();
      }
      return json;
    },
    3,
    1500,
    `${provider.name}.chatCompletion`,
    (err) =>
      err instanceof EmptyCompletionError ||
      (err instanceof LlmHttpError ? err.status >= 500 || err.status === 429 : true),
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
    { durationMs: Date.now() - t0, provider: provider.name, model: result.model, ...result.usage },
    "LLM chat completion done",
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
  provider: LlmProvider,
  model: string,
  url: string,
  t0: number,
  onChunk: (token: string) => void,
  onReset?: () => void,
): Promise<ChatCompletionResult> {
  return retry<ChatCompletionResult>(
    async () => {
      const result = await streamOnce(options, provider, model, url, onChunk);
      if (isUnusableCompletion(result.content)) {
        // Стёрли плохой ответ у клиента прямо сейчас (а не после backoff-задержки).
        onReset?.();
        throw new EmptyCompletionError();
      }
      logger.info(
        {
          durationMs: Date.now() - t0,
          provider: provider.name,
          model: result.model,
          chars: result.content.length,
        },
        "LLM streaming completion done",
      );
      return result;
    },
    3,
    1500,
    `${provider.name}.chatCompletion.stream`,
    (err) =>
      err instanceof EmptyCompletionError ||
      (err instanceof LlmHttpError ? err.status >= 500 || err.status === 429 : true),
  );
}

/** Одна попытка стриминга: fetch + чтение SSE-потока, onChunk на каждый токен. */
async function streamOnce(
  options: ChatCompletionOptions,
  provider: LlmProvider,
  model: string,
  url: string,
  onChunk: (token: string) => void,
): Promise<ChatCompletionResult> {
  const response = await fetch(url, {
    method: "POST",
    headers: makeHeaders(provider),
    body: JSON.stringify(buildBody(options, true, provider)),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new LlmHttpError(provider.name, response.status, text);
  }

  if (!response.body) {
    throw new Error("LLM streaming: response.body is null");
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
        let parsed: LlmStreamDelta;
        try {
          parsed = JSON.parse(raw) as LlmStreamDelta;
        } catch {
          continue;
        }
        if (parsed.model) responseModel = parsed.model;
        // reasoning_content DeepSeek (thinking-режим) читаем намеренно НЕ — пользователю
        // показываем только финальный ответ (delta.content), «мысли» отбрасываем.
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
