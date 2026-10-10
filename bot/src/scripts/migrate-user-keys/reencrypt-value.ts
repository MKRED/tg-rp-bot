import { isLegacyToken } from "./legacy-crypto.js";

/**
 * Обходит значение колонки (text, text[] или jsonb любой вложенности) и заменяет каждую строку-токен
 * v1 результатом swap. Остальное (открытые поля, числа, ключи объектов) не трогает — поэтому скрипту
 * не нужен список зашифрованных полей: в зашифрованных колонках все строки — токены, в открытых
 * токенов нет. Возвращает новое значение и число замен.
 */
export function reencryptValue(value: unknown, swap: (token: string) => string): { value: unknown; swapped: number } {
  let swapped = 0;
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") {
      if (!isLegacyToken(v)) return v;
      swapped++;
      return swap(v);
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v !== null && typeof v === "object") {
      return Object.fromEntries(Object.entries(v).map(([k, inner]) => [k, walk(inner)]));
    }
    return v;
  };
  const result = walk(value);
  return { value: result, swapped };
}
