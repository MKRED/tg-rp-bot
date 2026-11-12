import {
  DEFAULT_DEBUG_SETTINGS,
  MAX_DEBUG_EDGE_MESSAGES,
  MAX_DEBUG_REQUESTS,
  MIN_DEBUG_REQUESTS,
  type LlmDebugSettings,
} from "@tg-rp-bot/shared";

/**
 * Кламп настроек отладочного перехвата LLM (без состояния и I/O). Отдельно от debugCapture.ts
 * (in-memory механизм) и debug/ (персист в БД), чтобы оба слоя зависели от общего клампа, а не
 * друг от друга. Тип, диапазоны и дефолты — контракт с webapp, в @tg-rp-bot/shared.
 */
export { DEFAULT_DEBUG_SETTINGS, type LlmDebugSettings };

/** Кламп maxRequests в допустимый диапазон (единый для репозитория/кэша). */
export function clampMaxRequests(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_DEBUG_SETTINGS.maxRequests;
  return Math.min(MAX_DEBUG_REQUESTS, Math.max(MIN_DEBUG_REQUESTS, Math.floor(n)));
}

/** Кламп количества сообщений с края (>= 0). */
export function clampEdgeMessages(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_DEBUG_EDGE_MESSAGES, Math.max(0, Math.floor(n)));
}
