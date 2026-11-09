import type { RelayHubOptions } from "./relay/index.js";

/**
 * Удержание long-poll — заметно меньше таймаута простоя у edge-nginx (SSE соавтора шлёт ping раз в
 * 15 с, потому что тишину он рвёт). Окно «онлайн» — удержание плюс запас на переподключение агента.
 */
export const RELAY_OPTIONS: RelayHubOptions = {
  pollHoldMs: 20_000,
  onlineWindowMs: 35_000,
  jobTimeoutMs: 15_000,
};

/** Сколько живёт одноразовый код из команды установки агента. */
export const INSTALL_CODE_TTL_MS = 15 * 60_000;
