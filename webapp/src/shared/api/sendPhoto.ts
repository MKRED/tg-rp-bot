import type { SendPhotoRequest } from "@tg-rp-bot/shared";
import { apiFetch } from "./client";

export type SendPhotoToChatOptions = Pick<SendPhotoRequest, "label" | "deepLink">;

/**
 * Отправляет картинку (data URL) пользователю в чат с ботом: бот шлёт фото с инлайн-кнопками
 * «<имя>» (открывает Mini App на странице сущности) и «Закрыть». Замена «скачать»: в Telegram
 * webview на мобильных скачивание файла не работает, а сообщение в чате — нативно и надёжно.
 */
export async function sendPhotoToChat(
  dataUrl: string,
  opts: SendPhotoToChatOptions,
): Promise<void> {
  await apiFetch("/me/send-photo", {
    method: "POST",
    body: JSON.stringify({ image: dataUrl, label: opts.label, deepLink: opts.deepLink } satisfies SendPhotoRequest),
  });
}
