/**
 * Чистый контракт настроек отладочного перехвата LLM (без состояния и I/O).
 * Вынесен отдельно от debugCapture.ts (in-memory механизм) и userSettings.ts (персист в БД),
 * чтобы оба слоя зависели от общего типа/клампа, а не друг от друга.
 */

/**
 * Настройки перехвата, управляемые с экрана отладки (персистятся в user_settings, поэтому
 * синхронны между устройствами). enabled/maxRequests влияют на сам перехват; headMessages/
 * tailMessages — только на показ (сколько сообщений messages[] оставить с краёв), усечение
 * применяется на клиенте.
 */
export interface LlmDebugSettings {
  /** Писать ли лог запросов вообще (тумблер на экране). */
  enabled: boolean;
  /** Сколько последних запросов держать в кольце (на пользователя). */
  maxRequests: number;
  /** Сколько сообщений messages[] показывать с начала (усечение середины — на клиенте). */
  headMessages: number;
  /** Сколько сообщений messages[] показывать с конца. */
  tailMessages: number;
}

export const MIN_REQUESTS = 1;
export const MAX_REQUESTS = 200;
export const MAX_EDGE_MESSAGES = 200;
// Дефолт «включено» — осознанный выбор: перехват это escape-hatch, а не opt-in, поэтому при первом
// входе (нет строки в user_settings) и после рестарта экран не должен быть пустым на момент бага.
export const DEFAULT_DEBUG_SETTINGS: LlmDebugSettings = {
  enabled: true,
  maxRequests: 30,
  headMessages: 3,
  tailMessages: 5,
};

/** Кламп maxRequests в допустимый диапазон (единый для DAO/роута/кэша). */
export function clampMaxRequests(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_DEBUG_SETTINGS.maxRequests;
  return Math.min(MAX_REQUESTS, Math.max(MIN_REQUESTS, Math.floor(n)));
}

/** Кламп количества сообщений с края (>= 0). */
export function clampEdgeMessages(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_EDGE_MESSAGES, Math.max(0, Math.floor(n)));
}
