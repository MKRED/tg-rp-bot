/**
 * Русское склонение существительного по числу: forms = [одно, несколько, много] —
 * напр. ["запись", "записи", "записей"] → 1 запись, 3 записи, 5 записей, 11 записей, 21 запись.
 */
export function pluralRu(n: number, forms: readonly [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}
