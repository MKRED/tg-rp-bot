import { apiFetch } from "./client";

export interface SendPhotoToChatOptions {
  /** Текст кнопки-ссылки под фото = имя персонажа/персоны. */
  label: string;
  /** Внутренний путь Mini App для кнопки-ссылки: "/characters/:id" | "/personas/:id". */
  deepLink: string;
}

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
    body: JSON.stringify({ image: dataUrl, label: opts.label, deepLink: opts.deepLink }),
  });
}
