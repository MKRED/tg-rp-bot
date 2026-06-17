import { useEffect, useState } from "react";
import { apiFetch } from "../../../shared/api/client";
import { getCachedFull, setCachedFull } from "../lib/imageCache";

/**
 * Полноразмерное (некадрированное) фото персонажа как data URL — грузится лениво, только когда
 * enabled=true (открыт лайтбокс). Список так не тянет тяжёлое фото для каждой строки. Результат
 * кэшируется на сессию SPA. На любой сбой/отсутствие — undefined (вызывающий покажет миниатюру).
 */
export function useCharacterImageFull(id: number, enabled: boolean): string | undefined {
  const [dataUrl, setDataUrl] = useState<string | undefined>(() => getCachedFull(id));

  useEffect(() => {
    if (!enabled) return;
    const cached = getCachedFull(id);
    if (cached) {
      setDataUrl(cached);
      return;
    }
    let cancelled = false; // защита от StrictMode-двойного эффекта и размонтирования
    apiFetch<{ dataUrl: string | null }>(`/characters/${id}/image/full`)
      .then((res) => {
        if (!cancelled && res.dataUrl) {
          setCachedFull(id, res.dataUrl);
          setDataUrl(res.dataUrl);
        }
      })
      .catch(() => {
        // тихо: останется миниатюра как запасной вариант
      });
    return () => {
      cancelled = true;
    };
  }, [id, enabled]);

  return dataUrl;
}
