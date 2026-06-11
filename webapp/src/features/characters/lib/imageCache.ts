// Кэш аватаров на сессию SPA: id персонажа → data URL.
// Живёт пока открыта вкладка; при update/delete записи — инвалидируется через invalidateImage.
const cache = new Map<number, string>();

export function getCachedImage(id: number): string | undefined {
  return cache.get(id);
}

export function setCachedImage(id: number, dataUrl: string): void {
  cache.set(id, dataUrl);
}

export function invalidateImage(id: number): void {
  cache.delete(id);
}
