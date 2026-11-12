import { MalformedCompletionError, ResponseFailedError } from "../errors.js";
import type { ToolCall } from "../types.js";
import type { RawOutputItem, RawResponse, ResponsesResult } from "./types.js";

const BODY_SNIPPET_LENGTH = 200;

/** Склеенный текст частей content у элементов заданного типа (message → output_text, reasoning → reasoning_text). */
function joinText(items: RawOutputItem[], itemType: string, partType: string): string {
  return items
    .filter((i) => i.type === itemType)
    .flatMap((i) => i.content ?? [])
    .filter((p) => p.type === partType && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
}

/**
 * Вызовы инструментов. При обрыве по лимиту токенов (incompleteReason) последний вызов может быть с
 * неполными аргументами — его НЕ выбрасываем: без вызовов пустой ответ ушёл бы в бесполезные повторы с
 * тем же лимитом, а так вызывающий вернёт модели ошибку и она перепишет короче (см. coauthor turn-loop).
 */
function toolCalls(raw: RawResponse): ToolCall[] | undefined {
  // custom_tool_call (apply_patch) — в той же форме, ввод в arguments; порядок вызовов сохраняется.
  const calls: ToolCall[] = raw.output
    .filter((i) => (i.type === "function_call" || i.type === "custom_tool_call") && i.call_id && i.name)
    .map((i) =>
      i.type === "custom_tool_call"
        ? { id: i.call_id!, type: "custom" as const, function: { name: i.name!, arguments: i.input ?? "" } }
        : { id: i.call_id!, type: "function" as const, function: { name: i.name!, arguments: i.arguments ?? "" } },
    );
  return calls.length > 0 ? calls : undefined;
}

/** Объект ответа → результат. status "failed" — ResponseFailedError (ретраибл). */
export function toResponsesResult(providerName: string, raw: RawResponse): ResponsesResult {
  if (raw.status === "failed") {
    throw new ResponseFailedError(providerName, raw.error?.message ?? raw.error?.code ?? "status failed");
  }
  const reasoning = joinText(raw.output, "reasoning", "reasoning_text");
  const calls = toolCalls(raw);
  return {
    content: joinText(raw.output, "message", "output_text"),
    model: raw.model,
    usage: raw.usage
      ? {
          promptTokens: raw.usage.input_tokens,
          completionTokens: raw.usage.output_tokens,
          totalTokens: raw.usage.total_tokens,
          cachedTokens: raw.usage.input_tokens_details?.cached_tokens ?? 0,
          reasoningTokens: raw.usage.output_tokens_details?.reasoning_tokens ?? 0,
        }
      : undefined,
    ...(calls && { toolCalls: calls }),
    ...(reasoning && { reasoningContent: reasoning }),
    ...(raw.status === "incomplete" && { incompleteReason: raw.incomplete_details?.reason ?? "unknown" }),
  };
}

/** Тело non-stream ответа. Не похоже на ответ (не JSON, нет массива output) — MalformedCompletionError, ретраибл. */
export function parseResponseBody(providerName: string, text: string): RawResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new MalformedCompletionError(providerName, text.trim().slice(0, BODY_SNIPPET_LENGTH));
  }
  if (typeof parsed !== "object" || parsed === null || !Array.isArray((parsed as { output?: unknown }).output)) {
    throw new MalformedCompletionError(providerName, text.trim().slice(0, BODY_SNIPPET_LENGTH));
  }
  return parsed as RawResponse;
}
