import { DEFAULT_SEARCH_ROUNDS, MAX_SEARCH_ROUNDS, MIN_SEARCH_ROUNDS } from "@tg-rp-bot/shared";

/**
 * Кламп лимита раундов веб-поиска (без состояния и I/O), по образцу llm/debugSettings.ts: один на
 * репозиторий настроек и цикл tool-calling. Диапазон — общий с webapp (слайдер), в @tg-rp-bot/shared.
 */
export { DEFAULT_SEARCH_ROUNDS, MAX_SEARCH_ROUNDS, MIN_SEARCH_ROUNDS };

/** Кламп maxSearchRounds в допустимый диапазон. */
export function clampSearchRounds(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_SEARCH_ROUNDS;
  return Math.min(MAX_SEARCH_ROUNDS, Math.max(MIN_SEARCH_ROUNDS, Math.floor(n)));
}
