/**
 * Чистый контракт лимита раундов веб-поиска (без состояния и I/O), по образцу llm/debugSettings.ts:
 * общий кламп для DAO/роута/цикла tool-calling, а не рассинхронизированные копии диапазона.
 */

export const MIN_SEARCH_ROUNDS = 1;
// Верхняя граница держит суммарную длительность генерации в разумных пределах: каждый раунд —
// это отдельный вызов DeepSeek (thinking включён, секунды-десятки секунд) + Tavily-поиск,
// а запрос POST /cards/:id/generate не стримится и держит cardLock на всё время.
export const MAX_SEARCH_ROUNDS = 8;
export const DEFAULT_SEARCH_ROUNDS = 4;

/** Кламп maxSearchRounds в допустимый диапазон. */
export function clampSearchRounds(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_SEARCH_ROUNDS;
  return Math.min(MAX_SEARCH_ROUNDS, Math.max(MIN_SEARCH_ROUNDS, Math.floor(n)));
}
