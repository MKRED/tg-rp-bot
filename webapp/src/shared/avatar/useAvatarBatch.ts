import { useEffect, useState } from "react";
import { fetchAvatarsBatch } from "./avatars-api";
import { getCachedAvatar, setCachedAvatar } from "./avatarCache";
import type { AvatarRef } from "./avatarCache";

/**
 * Резолвит data URL для набора дескрипторов одним батч-запросом (после вычета кэш-хитов) —
 * для AvatarStack в списке историй / шапке чата. Некритично: на сбой остаётся пусто,
 * вызывающий показывает fallback (инициалы через acronym у Avatar, либо иконку/пусто у стека).
 */
export function useAvatarBatch(refs: (AvatarRef & { hasImage: boolean })[]): Map<string, string> {
  // Стабильный ключ эффекта — refs приходит новым массивом на каждый рендер.
  const depsKey = refs.map((r) => `${r.type}:${r.id}:${r.hasImage}`).join(",");
  const [, forceRerender] = useState(0);

  useEffect(() => {
    const missing = refs.filter((r) => r.hasImage && !getCachedAvatar(r));
    if (missing.length === 0) return;
    let cancelled = false;
    fetchAvatarsBatch(missing)
      .then(({ avatars }) => {
        if (cancelled || avatars.length === 0) return;
        for (const a of avatars) setCachedAvatar({ type: a.type, id: a.id }, a.dataUrl);
        forceRerender((n) => n + 1);
      })
      .catch(() => {
        // тихо: отсутствие аватара — не ошибка для пользователя, остаётся fallback
      });
    return () => {
      cancelled = true;
    };
    // depsKey — единственное, от чего реально должен перезапускаться эффект (refs — новый массив
    // на каждый рендер, зависеть от него напрямую значило бы рефетчить на каждый ре-рендер).
  }, [depsKey]);

  const resolved = new Map<string, string>();
  for (const r of refs) {
    const cached = getCachedAvatar(r);
    if (cached) resolved.set(`${r.type}:${r.id}`, cached);
  }
  return resolved;
}
