/**
 * Типы отладочного перехвата LLM — ручное зеркало серверных. При изменении на сервере
 * синхронизировать здесь вручную: LlmCallLabel (bot/src/llm/debugCapture.ts), LlmDebugSettings
 * (bot/src/llm/debugSettings.ts), поля LlmDebugRecord/LlmDebugResponse (bot/src/llm/debugCapture.ts).
 */

export type LlmCallLabel =
  | "rp"
  | "impersonate"
  | "narrator"
  | "translate"
  | "compact"
  | "cards"
  | "other";

export interface LlmDebugResponse {
  ok: boolean;
  status?: number;
  content?: string;
  model?: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens?: number };
  error?: string;
}

export interface LlmDebugRecord {
  id: number;
  at: string;
  userId: number | null;
  label: LlmCallLabel;
  provider: string;
  model: string;
  streaming: boolean;
  durationMs: number;
  /** RAW-тело запроса (messages[] + сэмплинг-поля) — отображаем как есть. */
  request: Record<string, unknown>;
  response: LlmDebugResponse;
}

export interface LlmDebugSettings {
  /** Писать ли RAW-лог запросов (тумблер). */
  enabled: boolean;
  /** Сколько последних запросов держать. */
  maxRequests: number;
  /** Сколько сообщений messages[] показывать с начала (усечение середины — на клиенте). */
  headMessages: number;
  /** Сколько сообщений messages[] показывать с конца. */
  tailMessages: number;
}
