import type { SendPhotoRequest } from "@tg-rp-bot/shared";
import { apiFetch } from "./client";

/**
 * Отправляет картинку (data URL) пользователю в чат с ботом — без подписи, с кнопкой «Закрыть».
 * Замена «скачать»: в Telegram webview на мобильных скачивание файла не работает, а сообщение в чате —
 * нативно и надёжно. Картинку перед отправкой ужимает makeShareable (shared/image/share).
 */
export async function sendPhotoToChat(dataUrl: string): Promise<void> {
  await apiFetch("/me/send-photo", {
    method: "POST",
    body: JSON.stringify({ image: dataUrl } satisfies SendPhotoRequest),
  });
}
