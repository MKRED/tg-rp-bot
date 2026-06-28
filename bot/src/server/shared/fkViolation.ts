/**
 * Проверяет, является ли ошибка нарушением FK-ограничения PostgreSQL (SQLSTATE 23503).
 * DrizzleQueryError оборачивает нативный PostgresError (postgres.js) в поле .cause, поэтому
 * проверяем оба уровня — иначе code === "23503" не находится на верхнем уровне.
 *
 * Общий хелпер: до рефакторинга дублировался в каждом CRUD-контроллере
 * (characters/personas/presets/books/narrator-templates) — превращался в 409 in_use при удалении
 * сущности, на которую ссылается чат/история.
 */
export const isFkViolation = (err: unknown): boolean => {
  if (typeof err !== "object" || err === null) return false;
  const e = err as Record<string, unknown>;
  if (e.code === "23503") return true;
  const cause = e.cause;
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in (cause as object) &&
    (cause as Record<string, unknown>).code === "23503"
  );
};
