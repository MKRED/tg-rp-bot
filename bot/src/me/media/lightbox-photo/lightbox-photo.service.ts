import { Injectable } from "@nestjs/common";
import { Bot, InlineKeyboard, InputFile } from "grammy";
import logger from "../../../logger.js";
import { PHOTO_CLOSE_CALLBACK } from "../../../telegram/telegram.constants.js";

/**
 * Отправляет пользователю в личный чат картинку из просмотра Mini App — без подписи, с одной
 * инлайн-кнопкой «Закрыть» (удаляет сообщение, см. telegram/handlers/photo-actions.handler.ts).
 *
 * Бросает при сбое Bot API (напр. 403, если пользователь заблокировал бота) — вызывающий сервис
 * логирует и отдаёт понятную ошибку.
 */
@Injectable()
export class LightboxPhotoService {
  constructor(private readonly bot: Bot) {}

  /** dataUrl — data:image/*;base64,…. */
  async send(telegramId: number, dataUrl: string): Promise<void> {
    // data:image/jpeg;base64,XXXX → берём часть после запятой и декодируем в бинарь.
    const commaIdx = dataUrl.indexOf(",");
    if (commaIdx === -1) throw new Error("Malformed data URL (no comma separator)");
    const buffer = Buffer.from(dataUrl.slice(commaIdx + 1), "base64");

    logger.debug({ telegramId, bytes: buffer.length }, "Sending lightbox photo to chat");
    const t0 = Date.now();
    await this.bot.api.sendPhoto(telegramId, new InputFile(buffer), {
      reply_markup: new InlineKeyboard().text("Закрыть", PHOTO_CLOSE_CALLBACK),
    });
    logger.info({ telegramId, bytes: buffer.length, durationMs: Date.now() - t0 }, "Lightbox photo sent to chat");
  }
}
