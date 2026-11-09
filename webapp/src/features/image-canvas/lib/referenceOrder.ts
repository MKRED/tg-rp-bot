/** Порядок картинок без изменений: [0, 1, …, count-1]. */
export function identityOrder(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i);
}

/** Порядок изменился относительно исходного (order[i] — прежний слот картинки на месте i). */
export function isReordered(order: number[]): boolean {
  return order.some((from, i) => from !== i);
}

/** «Левее / Правее»: картинка с места position меняется с соседкой. За краем — null. */
export function swapOrder(count: number, position: number, dir: -1 | 1): number[] | null {
  const target = position + dir;
  if (position < 0 || position >= count || target < 0 || target >= count) return null;
  const order = identityOrder(count);
  [order[position], order[target]] = [order[target]!, order[position]!];
  return order;
}

/**
 * Ключи плиток по самой картинке, а не по слоту: после перестановки сервер отдаёт картинки в новых слотах,
 * и ключ по слоту достался бы другой картинке — плитки сперва прыгали бы назад, а потом ехали на место.
 * Одинаковые картинки различаются номером повтора.
 */
export function tileKeys(thumbs: string[]): string[] {
  const seen = new Map<string, number>();
  return thumbs.map((thumb) => {
    const base = `${thumb.length}:${thumb.slice(-24)}`;
    const repeat = seen.get(base) ?? 0;
    seen.set(base, repeat + 1);
    return `${base}#${repeat}`;
  });
}

/** Порядок плиток (ключи) → перестановка слотов для сервера: order[i] — прежний слот картинки на месте i. */
export function orderFromKeys(keys: string[], arranged: string[]): number[] {
  return arranged.map((key) => keys.indexOf(key));
}

/** Порядок от протяжки годится, пока в нём ровно те же картинки; иначе (холст сменился) — порядок сервера. */
export function arrangedKeys(keys: string[], arranged: string[]): string[] {
  const same = arranged.length === keys.length && arranged.every((key) => keys.includes(key));
  return same ? arranged : keys;
}
