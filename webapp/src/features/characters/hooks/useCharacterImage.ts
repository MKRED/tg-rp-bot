import { useEffect, useState } from "react";
import { apiFetch } from "../../../shared/api/client";

/**
 * Аватар персонажа как data URL (или undefined, пока грузится / нет картинки).
 *
 * Список (GET /characters) отдаёт лишь флаг hasImage, чтобы не тянуть base64 всех персонажей
 * разом — саму картинку грузим построчно отдельным запросом, по образцу useProfilePhoto.
 * Аватар некритичен: на любой сбой остаёмся с undefined, вызывающий показывает инициалы.
 */
export function useCharacterImage(id: number, hasImage: boolean): string | undefined {
  const [dataUrl, setDataUrl] = useState<string>();

  useEffect(() => {
    if (!hasImage) return; // нет картинки — сервер не дёргаем
    let cancelled = false; // защита от StrictMode-двойного эффекта и размонтирования
    apiFetch<{ dataUrl: string | null }>(`/characters/${id}/image`)
      .then((res) => {
        if (!cancelled && res.dataUrl) setDataUrl(res.dataUrl);
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
