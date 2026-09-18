/** Пул с ограниченной конкурентностью — не бомбим неофициальный Google-эндпоинт/личный ключ DeepSeek. */
export async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function runOne(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index] as T);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runOne()));
  return results;
}
