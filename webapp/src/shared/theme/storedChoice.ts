/**
 * Значение из localStorage, если оно — один из ключей options; иначе fallback (пусто, старое
 * значение удалённого варианта, мусор). Чистая функция — чтение самого localStorage у вызывающего.
 */
export function parseStoredChoice<T extends string>(raw: string | null, options: Record<T, unknown>, fallback: T): T {
  return raw !== null && Object.hasOwn(options, raw) ? (raw as T) : fallback;
}
