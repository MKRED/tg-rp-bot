/**
 * Число из query: повтор параметра (?page=1&page=2) → первое значение, как c.req.query в Hono.
 * Нечисловое значение → дефолт, дробь — отбрасываем (в Hono такие доходили до SQL и давали 500).
 */
export function queryInt(raw: unknown, fallback: number): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
