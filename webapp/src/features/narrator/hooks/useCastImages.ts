import { useEffect, useState } from "react";
import { apiFetch } from "../../../shared/api/client";
import type { StoryAvatarRef } from "../types/story";

/** Ключ картинки героя: "character:12" / "persona:3" — как у кэша аватаров. */
export const castKey = (a: StoryAvatarRef): string => `${a.type}:${a.id}`;

/**
 * Полные (некадрированные) картинки героев истории для галереи — грузятся, только когда галерея
 * открыта (enabled), все разом; уже загруженные не перезапрашиваются. Не загрузилась — в ключе null:
 * галерея покажет вместо неё миниатюру-аватар, а не вечный спиннер.
 */
export function useCastImages(cast: StoryAvatarRef[], enabled: boolean): Record<string, string | null> {
  const [images, setImages] = useState<Record<string, string | null>>({});
  const depsKey = cast.map(castKey).join(",");

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    for (const a of cast) {
      const key = castKey(a);
      if (key in images) continue;
      apiFetch<{ dataUrl: string | null }>(`/${a.type === "character" ? "characters" : "personas"}/${a.id}/image/full`)
        .then((res) => {
          if (!cancelled) setImages((prev) => ({ ...prev, [key]: res.dataUrl }));
        })
        .catch((err: unknown) => {
          console.error("Failed to load cast image", { key, err });
          if (!cancelled) setImages((prev) => ({ ...prev, [key]: null }));
        });
    }
    return () => {
      cancelled = true;
    };
    // depsKey вместо cast: массив приходит новым на каждый рендер; images — не зависимость, иначе
    // каждая догруженная картинка перезапускала бы эффект и отменяла ещё летящие запросы.
  }, [depsKey, enabled]);

  return images;
}
