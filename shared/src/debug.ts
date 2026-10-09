// Контракт /api/debug/llm — экран отладки: RAW-запросы к LLM, перехваченные сервером, и настройки
// перехвата (персистятся в user_settings, синхронны между устройствами).

/** Ярлык типа вызова — чтобы в списке было видно, что за запрос. */
export type LlmCallLabel = "rp" | "impersonate" | "narrator" | "translate" | "compact" | "cards" | "other";

/** Вызов инструмента в ответе модели (формат OpenAI-совместимого API, function calling). */
export interface LlmToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

/** Ответ LLM в записи: успех (content/usage) либо провал (status/error). */
export interface LlmDebugResponse {
  ok: boolean;
  /** HTTP-статус провайдера при ошибке — если был. */
  status?: number;
  content?: string;
  model?: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens?: number };
  /** Текст ошибки/тела при провале (4xx/5xx, пустой/отказной ответ). */
  error?: string;
  /** Модель запросила инструмент(ы) вместо текста — иначе content выглядел бы пустым «успехом». */
  toolCalls?: LlmToolCall[];
}

/** Одна запись перехвата: что ушло в LLM и что вернулось. */
export interface LlmDebugRecord {
  id: number;
  /** ISO-время. */
  at: string;
  userId: number | null;
  label: LlmCallLabel;
  provider: string;
  model: string;
  streaming: boolean;
  durationMs: number;
  /** RAW-тело запроса со всеми сэмплинг-полями и полным messages[]. */
  request: Record<string, unknown>;
  response: LlmDebugResponse;
}

/**
 * Настройки перехвата. enabled/maxRequests влияют на сам перехват; headMessages/tailMessages — только
 * на показ (сколько сообщений messages[] оставить с краёв), усечение применяется на клиенте.
 */
export interface LlmDebugSettings {
  /** Писать ли лог запросов вообще (тумблер на экране). */
  enabled: boolean;
  /** Сколько последних запросов держать в кольце (на пользователя). */
  maxRequests: number;
  /** Сколько сообщений messages[] показывать с начала. */
  headMessages: number;
  /** Сколько сообщений messages[] показывать с конца. */
  tailMessages: number;
}

/** Частичный patch настроек; числа сервер клампит в диапазоны ниже. */
export type LlmDebugSettingsPatch = Partial<LlmDebugSettings>;

/** Ответ GET /api/debug/llm. */
export interface LlmDebugView {
  settings: LlmDebugSettings;
  records: LlmDebugRecord[];
}

export const MIN_DEBUG_REQUESTS = 1;
export const MAX_DEBUG_REQUESTS = 200;
export const MAX_DEBUG_EDGE_MESSAGES = 200;

// Дефолт «включено» — осознанный выбор: перехват это escape-hatch, а не opt-in, поэтому при первом
// входе (нет строки в user_settings) и после рестарта экран не должен быть пустым на момент бага.
export const DEFAULT_DEBUG_SETTINGS: LlmDebugSettings = {
  enabled: true,
  maxRequests: 30,
  headMessages: 3,
  tailMessages: 5,
};
