// Кэш аватаров на сессию SPA: id персоны → data URL.
// Живёт пока открыта вкладка; при update/delete записи — инвалидируется через invalidateImage.
const cache = new Map<number, string>();
// Отдельный кэш полноразмерного (некадрированного) фото — грузится только при открытии лайтбокса.
const fullCache = new Map<number, string>();

export function getCachedImage(id: number): string | undefined {
  return cache.get(id);
}

export function setCachedImage(id: number, dataUrl: string): void {
  cache.set(id, dataUrl);
}

export function getCachedFull(id: number): string | undefined {
  return fullCache.get(id);
}

export function setCachedFull(id: number, dataUrl: string): void {
  fullCache.set(id, dataUrl);
}

export function invalidateImage(id: number): void {
  cache.delete(id);
  fullCache.delete(id);
}
