import logger from "../../logger.js";
import { retry } from "../../utils/index.js";
import { isUnusableCompletion } from "../completionGuard.js";
import { RESPONSES_PATH } from "../constants.js";
import { type LlmDebugResponse, recordLlmCall } from "../debugCapture.js";
import { EmptyCompletionError, isRetryableLlmError, LlmHttpError } from "../errors.js";
import type { LlmProvider } from "../providers.js";
import { redactImageUrls } from "../redact-images.js";
import { makeHeaders } from "../request.js";
import type { OnToolCallDelta } from "../types.js";
import { buildResponsesBody } from "./request.js";
import { parseResponseBody, toResponsesResult } from "./result.js";
import { parseSseData, ResponsesStreamParser } from "./stream.js";
import type { ResponsesRequestOptions, ResponsesResult } from "./types.js";

/**
 * Запрос к DeepSeek Responses API — для путей, которым нужны картинки в результатах инструментов
 * (сейчас только соавтор). Поведение то же, что у requestChatCompletion (client.ts): retry на 5xx/429,
 * сеть и непригодный ответ; onReset перед повтором, если что-то уже показано; запись в отладку на
 * каждый вызов. Обычный fetch — без Telegram-прокси.
 */
export async function requestResponse(
  provider: LlmProvider,
  options: ResponsesRequestOptions,
  onChunk?: (token: string) => void,
  onReset?: () => void,
  onToolCall?: OnToolCallDelta,
): Promise<ResponsesResult> {
  const model = options.model ?? provider.defaultModel;
  const url = `${provider.baseUrl}${RESPONSES_PATH}`;
  const streaming = !!onChunk;
  const t0 = Date.now();
  logger.debug({ provider: provider.name, model, inputItems: options.input.length, streaming }, "LLM response start");

  let response: LlmDebugResponse = { ok: false };
  try {
    const result = await retry<ResponsesResult>(
      async () => {
        let emitted = false;
        const attempt = attemptOnce(provider, options, url, streaming, (token) => {
          emitted = true;
          onChunk?.(token);
        }, (call) => {
          emitted = true;
          onToolCall?.(call);
        });
        const result = await attempt.catch((err: unknown) => {
          // Обрыв посреди потока: без сброса клиент склеил бы показанное со следующей попыткой.
          if (emitted) onReset?.();
          throw err;
        });
        // Ответ из одних вызовов инструментов с пустым текстом — штатный, если инструменты предлагались.
        const hasToolCalls = !!options.tools?.length && !!result.toolCalls?.length;
        if (!hasToolCalls && isUnusableCompletion(result.content)) {
          if (emitted) onReset?.();
          logger.warn({ provider: provider.name, model, incompleteReason: result.incompleteReason }, "LLM response: пустой ответ");
          throw new EmptyCompletionError();
        }
        return result;
      },
      3,
      1500,
      `${provider.name}.responses`,
      isRetryableLlmError,
    );

    if (result.incompleteReason) {
      logger.warn({ provider: provider.name, model, reason: result.incompleteReason }, "LLM response обрезан (incomplete)");
    }
    logger.info(
      {
        durationMs: Date.now() - t0,
        provider: provider.name,
        model: result.model,
        streaming,
        ...result.usage,
        toolCalls: result.toolCalls?.length ?? 0,
        chars: result.content.length,
      },
      "LLM response done",
    );
    response = { ok: true, content: result.content, model: result.model, usage: result.usage, toolCalls: result.toolCalls };
    return result;
  } catch (err) {
    response = {
      ok: false,
      status: err instanceof LlmHttpError ? err.status : undefined,
      error: err instanceof Error ? err.message : String(err),
    };
    throw err;
  } finally {
    recordLlmCall({
      at: new Date().toISOString(),
      userId: options.userId,
      label: options.debugLabel ?? "other",
      provider: provider.name,
      model,
      streaming,
      durationMs: Date.now() - t0,
      request: redactImageUrls(buildResponsesBody(options, streaming, provider)),
      response,
    });
  }
}

/** Одна попытка: fetch + разбор тела (non-stream) или событий (stream). */
async function attemptOnce(
  provider: LlmProvider,
  options: ResponsesRequestOptions,
  url: string,
  streaming: boolean,
  onChunk: (token: string) => void,
  onToolCall: OnToolCallDelta,
): Promise<ResponsesResult> {
  const res = await fetch(url, {
    method: "POST",
    headers: makeHeaders(provider),
    body: JSON.stringify(buildResponsesBody(options, streaming, provider)),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new LlmHttpError(provider.name, res.status, text);
  }
  if (!streaming) return toResponsesResult(provider.name, parseResponseBody(provider.name, await res.text()));
  if (!res.body) throw new Error("LLM response streaming: response.body is null");

  const parser = new ResponsesStreamParser(provider.name, onChunk, onToolCall);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // Последняя (возможно неполная) строка остаётся в буфере до следующего куска.
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const event = parseSseData(line);
        if (event) parser.push(event);
      }
    }
    const tail = parseSseData(buffer + decoder.decode());
    if (tail) parser.push(tail);
  } finally {
    reader.releaseLock();
  }
  return toResponsesResult(provider.name, parser.result());
}
