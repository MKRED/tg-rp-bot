import { InlineKeyboard, InputFile } from "grammy";
import { bot } from "../../../bot.js";
import { config } from "../../../config.js";
import { PHOTO_CLOSE_CALLBACK } from "../../../handlers/photoActions.constants.js";
import logger from "../../../logger.js";
import { DEEP_LINK_PARAM } from "./photoToChat.constants.js";
import type { SendPhotoOptions } from "./photoToChat.types.js";

/**
 * Отправляет пользователю в личный чат фото из лайтбокса Mini App с инлайн-клавиатурой:
 * кнопка-ссылка «<имя>» (web_app-кнопка, открывает Mini App на странице персонажа/персоны)
 * и «Закрыть» (удаляет сообщение, см. handlers/photoActions.ts).
 *
 * web_app-кнопка работает только в личке и только с доменом Mini App из BotFather (= WEBAPP_URL).
 * Если WEBAPP_URL не задан (dev) — кнопки-ссылки нет, имя уходит обычной подписью.
 *
 * Бросает при сбое Bot API (напр. 403, если пользователь заблокировал бота) — вызывающий роут
 * логирует и отдаёт понятную ошибку.
 */
export async function sendLightboxPhoto(userId: number, opts: SendPhotoOptions): Promise<void> {
  const { dataUrl, label, deepLink } = opts;

  // data:image/jpeg;base64,XXXX → берём часть после запятой и декодируем в бинарь.
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx === -1) throw new Error("Malformed data URL (no comma separator)");
  const buffer = Buffer.from(dataUrl.slice(commaIdx + 1), "base64");

  const keyboard = new InlineKeyboard();
  let caption: string | undefined;
  if (config.webAppUrl) {
    const url = new URL(config.webAppUrl);
    url.searchParams.set(DEEP_LINK_PARAM, deepLink);
    keyboard.webApp(label, url.toString()).row();
  } else {
    // Без публичного URL Mini App кнопку-ссылку не построить — отдаём имя подписью.
    caption = label;
  }
  keyboard.text("Закрыть", PHOTO_CLOSE_CALLBACK);

  logger.debug({ userId, bytes: buffer.length, deepLink }, "Sending lightbox photo to chat");
  const t0 = Date.now();
  await bot.api.sendPhoto(userId, new InputFile(buffer), {
    caption,
    reply_markup: keyboard,
  });
  logger.info(
    { userId, bytes: buffer.length, deepLink, durationMs: Date.now() - t0 },
    "Lightbox photo sent to chat",
  );
}
