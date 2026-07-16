/** Дескриптор аватара (эхо серверного StoryAvatarRef, без завязки на фичу narrator). */
export type AvatarRef = { type: "character" | "persona"; id: number };

// Кэш на сессию SPA: "type:id" → data URL. Живёт пока открыта вкладка; при update/delete
// персонажа/персоны — инвалидируется через invalidateAvatar (см. characters-api/personas-api).
const cache = new Map<string, string>();

function cacheKey(ref: AvatarRef): string {
  return `${ref.type}:${ref.id}`;
}

export function getCachedAvatar(ref: AvatarRef): string | undefined {
  return cache.get(cacheKey(ref));
}

export function setCachedAvatar(ref: AvatarRef, dataUrl: string): void {
  cache.set(cacheKey(ref), dataUrl);
}

export function invalidateAvatar(ref: AvatarRef): void {
  cache.delete(cacheKey(ref));
}
