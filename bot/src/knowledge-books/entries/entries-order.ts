// Чистая логика порядка записей книги знаний (без I/O — тестируется изолированно).

/**
 * orderedIds — ровно перестановка currentIds: та же длина, без дублей, тот же набор элементов.
 * Защита reorder-эндпоинта от порчи порядка при рассинхроне клиента (чужие/пропущенные/повторные id).
 */
export function isPermutationOf(orderedIds: number[], currentIds: number[]): boolean {
  if (orderedIds.length !== currentIds.length) return false;
  if (new Set(orderedIds).size !== orderedIds.length) return false;
  const current = new Set(currentIds);
  return orderedIds.every((id) => current.has(id));
}
