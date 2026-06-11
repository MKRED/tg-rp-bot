import { useEffect, useState } from "react";
import { apiFetch } from "../../../shared/api/client";
import { getCachedImage, setCachedImage } from "../lib/imageCache";

/**
 * Аватар персоны как data URL (или undefined, пока грузится / нет картинки).
 * Результат кэшируется в памяти на сессию SPA: повторный переход к списку не делает запросов.
 * Аватар некритичен: на любой сбой остаёмся с undefined, вызывающий показывает заглушку.
 */
export function usePersonaImage(id: number, hasImage: boolean): string | undefined {
  const [dataUrl, setDataUrl] = useState<string | undefined>(() => getCachedImage(id));

  useEffect(() => {
    if (!hasImage) {
      // Аватар убрали (update без картинки) — сброс отображаемого значения
      setDataUrl(undefined);
      return;
    }
    // Кэш-хит — запрос не нужен
    const cached = getCachedImage(id);
    if (cached) {
      setDataUrl(cached);
      return;
    }
    let cancelled = false;
    apiFetch<{ dataUrl: string | null }>(`/personas/${id}/image`)
      .then((res) => {
        if (!cancelled && res.dataUrl) {
          setCachedImage(id, res.dataUrl);
          setDataUrl(res.dataUrl);
        }
      })
      .catch(() => {
        // тихо: заглушка с инициалами
      });
    return () => {
      cancelled = true;
    };
  }, [id, hasImage]);

  return dataUrl;
}
