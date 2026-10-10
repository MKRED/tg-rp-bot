/**
 * Нарушение UNIQUE-ограничения PostgreSQL (SQLSTATE 23505). Как и в isFkViolation, код бывает и на
 * самой ошибке, и в .cause (DrizzleQueryError оборачивает PostgresError postgres.js).
 */
export const isUniqueViolation = (err: unknown): boolean => {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: unknown; cause?: { code?: unknown } | null };
  return e.code === "23505" || (typeof e.cause === "object" && e.cause !== null && e.cause.code === "23505");
};
