import { useEffect, useState } from "react";
import { apiFetch } from "../../../shared/api/client";
import { getCachedFull, setCachedFull } from "../lib/imageCache";

/**
 * Полноразмерное (некадрированное) фото персоны как data URL — грузится лениво, только когда
 * enabled=true (открыт лайтбокс). Список так не тянет тяжёлое фото для каждой строки. Результат
 * кэшируется на сессию SPA. На любой сбой/отсутствие — src=undefined (вызывающий покажет миниатюру).
 * Флаг loading=true, пока фото догружается: лайтбокс по нему держит индикатор вместо миниатюры,
 * чтобы картинка не «скакала» при подмене на оригинал.
 */
export function usePersonaImageFull(
  id: number,
  enabled: boolean,
): { src: string | undefined; loading: boolean } {
  const [dataUrl, setDataUrl] = useState<string | undefined>(() => getCachedFull(id));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const cached = getCachedFull(id);
    if (cached) {
      setDataUrl(cached);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiFetch<{ dataUrl: string | null }>(`/personas/${id}/image/full`)
      .then((res) => {
        if (!cancelled && res.dataUrl) {
          setCachedFull(id, res.dataUrl);
          setDataUrl(res.dataUrl);
        }
      })
      .catch(() => {
        // тихо: останется миниатюра как запасной вариант
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, enabled]);

  return { src: dataUrl, loading };
}
