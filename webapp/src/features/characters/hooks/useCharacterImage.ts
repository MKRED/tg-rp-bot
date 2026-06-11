import { useEffect, useState } from "react";
import { apiFetch } from "../../../shared/api/client";
import { getCachedImage, setCachedImage } from "../lib/imageCache";

/**
 * Аватар персонажа как data URL (или undefined, пока грузится / нет картинки).
 *
 * Список (GET /characters) отдаёт лишь флаг hasImage, чтобы не тянуть base64 всех персонажей
 * разом — саму картинку грузим построчно отдельным запросом, по образцу useProfilePhoto.
 * Результат кэшируется в памяти на сессию SPA: повторный переход к списку не делает запросов.
 * Аватар некритичен: на любой сбой остаёмся с undefined, вызывающий показывает инициалы.
 */
export function useCharacterImage(id: number, hasImage: boolean): string | undefined {
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
    let cancelled = false; // защита от StrictMode-двойного эффекта и размонтирования
    apiFetch<{ dataUrl: string | null }>(`/characters/${id}/image`)
      .then((res) => {
        if (!cancelled && res.dataUrl) {
          setCachedImage(id, res.dataUrl);
          setDataUrl(res.dataUrl);
        }
      })
      .catch(() => {
        // тихо: отсутствие аватара — не ошибка для пользователя, остаётся заглушка
      });
    return () => {
      cancelled = true;
    };
  }, [id, hasImage]);

  return dataUrl;
}
