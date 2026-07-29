/** Типы перехвата RAW-запросов к LLM — вынесены из debugCapture.ts (там остаётся логика кольца). */

/** Ярлык типа вызова — чтобы в списке было видно, что за запрос. */
export type LlmCallLabel =
  | "rp"
  | "impersonate"
  | "narrator"
  | "translate"
  | "compact"
  | "cards"
  | "other";

/** Ответ LLM в записи: успех (content/usage) либо провал (status/error). */
export interface LlmDebugResponse {
  ok: boolean;
  /** HTTP-статус провайдера при ошибке (LlmHttpError) — если был. */
  status?: number;
  content?: string;
  model?: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens?: number };
  /** Текст ошибки/тела при провале (4xx/5xx, пустой/отказной ответ). */
  error?: string;
}

/** Одна запись перехвата: что ушло в LLM и что вернулось. */
export interface LlmDebugRecord {
  id: number;
  at: string; // ISO-время
  userId: number | null;
  label: LlmCallLabel;
  provider: string;
  model: string;
  streaming: boolean;
  durationMs: number;
  /** RAW-тело запроса (после buildBody) со всеми сэмплинг-полями и полным messages[]. */
  request: Record<string, unknown>;
  response: LlmDebugResponse;
}
