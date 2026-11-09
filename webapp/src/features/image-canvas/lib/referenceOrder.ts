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
