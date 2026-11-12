import { MalformedCompletionError } from "../errors.js";
import type { LlmResponse } from "./types.js";

/** Сколько символов тела попадает в ошибку — для лога хватает, а целиком тело может быть огромным. */
const BODY_SNIPPET_LENGTH = 200;

/**
 * Разбирает тело non-stream ответа chat completion. Всё, что не похоже на ответ (не JSON, `null`, нет
 * массива choices), — MalformedCompletionError с началом тела, а не TypeError из глубины разбора:
 * иначе сбой провайдера выглядит в логах как баг нашего кода. Пустые keep-alive строки DeepSeek
 * (шлёт их, пока запрос стоит в очереди) JSON.parse пропускает сам — это пробельные символы.
 */
export function parseCompletionBody(providerName: string, text: string): LlmResponse {
  const snippet = () => text.trim().slice(0, BODY_SNIPPET_LENGTH);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new MalformedCompletionError(providerName, snippet());
  }
  if (typeof parsed !== "object" || parsed === null || !Array.isArray((parsed as { choices?: unknown }).choices)) {
    throw new MalformedCompletionError(providerName, snippet());
  }
  return parsed as LlmResponse;
}
