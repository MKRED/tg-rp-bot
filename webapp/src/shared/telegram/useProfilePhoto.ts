import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";

// Кэш фото профиля на сессию SPA — фото одно, инвалидация не нужна.
let cachedPhotoUrl: string | undefined;

/**
 * Фото профиля текущего пользователя как data URL (или undefined, пока грузится / нет фото).
 *
 * initData при запуске бота кнопкой/меню не содержит photo_url, поэтому фото отдаёт сервер
 * (GET /api/me/photo → { dataUrl }). Аватар некритичен: на любой сбой остаёмся с undefined,
 * вызывающий показывает заглушку с инициалами.
 */
export function useProfilePhoto(): string | undefined {
  const [dataUrl, setDataUrl] = useState<string | undefined>(() => cachedPhotoUrl);

  useEffect(() => {
    if (cachedPhotoUrl) {
      setDataUrl(cachedPhotoUrl);
      return;
    }
    let cancelled = false; // защита от StrictMode-двойного эффекта и размонтирования
    apiFetch<{ dataUrl: string | null }>("/me/photo")
      .then((res) => {
        if (!cancelled && res.dataUrl) {
          cachedPhotoUrl = res.dataUrl;
          setDataUrl(res.dataUrl);
        }
      })
      .catch(() => {
        // тихо: отсутствие аватара — не ошибка для пользователя, остаётся заглушка
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return dataUrl;
}
