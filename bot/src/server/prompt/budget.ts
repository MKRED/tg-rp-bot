/**
 * Общий бюджет обрезки истории под лимит контекста — переиспользуется обоими билдерами
 * промптов (RP `promptBuilder` и narrator `storyPromptBuilder`). До рефакторинга константы и
 * `trimHistoryToBudget` дублировались в каждом файле.
 */

/** Резерв токенов под ответ модели, когда maxTokens не задан (иначе вход съел бы всё окно). */
export const DEFAULT_OUTPUT_RESERVE = 512;
/** Надбавка на одно сообщение (роль/служебная разметка чат-формата) — для запаса бюджета. */
export const PER_MESSAGE_OVERHEAD = 4;

/** Сводка по обрезке истории под лимит контекста — отдаётся в onTrim для логирования. */
export type TrimInfo = { dropped: number; kept: number; total: number };

/**
 * Урезает историю под бюджет: оставляет самые НОВЫЕ сообщения, отбрасывая старые с начала, пока
 * суммарная стоимость не превысит budget. Сохраняет хронологический порядок. Чистая функция —
 * стоимость сообщения считает переданный cost (в проде — countTokens + надбавка; в тестах — фейк).
 */
export function trimHistoryToBudget<T>(
  history: T[],
  budget: number,
  cost: (msg: T) => number,
): T[] {
  if (budget <= 0) return [];
  const kept: T[] = [];
  let used = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i]!;
    used += cost(msg);
    if (used > budget) break;
    kept.push(msg);
  }
  kept.reverse();
  return kept;
}
