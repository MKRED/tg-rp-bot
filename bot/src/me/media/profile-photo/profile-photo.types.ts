/** Запись кэша фото профиля: data URL (или null, если фото нет) и время истечения. */
export type CacheEntry = { dataUrl: string | null; expires: number };
