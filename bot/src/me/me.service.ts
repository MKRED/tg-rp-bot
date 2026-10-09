import { BadGatewayException, Injectable } from "@nestjs/common";
import type { SendPhotoRequest } from "@tg-rp-bot/shared";
import logger from "../logger.js";
import { getProfilePhotoDataUrl, sendLightboxPhoto } from "./media/index.js";

/**
 * Текущий пользователь Telegram: фото профиля и отправка фото себе в чат с ботом — обе операции через
 * Bot API, поэтому принимают Telegram id (он же chat id лички), а не внутренний userId.
 */
@Injectable()
export class MeService {
  /**
   * Фото профиля как data URL. Аватар некритичен — на любой сбой null: webapp покажет заглушку с
   * инициалами, а не ошибку.
   */
  async profilePhoto(telegramId: number): Promise<string | null> {
    try {
      return await getProfilePhotoDataUrl(telegramId);
    } catch (err) {
      logger.error({ err, telegramId }, "Failed to fetch profile photo");
      return null;
    }
  }

  /**
   * Фото из лайтбокса в личку: на мобильных скачивание картинки из webview не работает — отправка в
   * чат заменяет «скачать». Сбой Bot API — 502 send_failed.
   */
  async sendPhoto(telegramId: number, { image, label, deepLink }: SendPhotoRequest): Promise<void> {
    try {
      await sendLightboxPhoto(telegramId, { dataUrl: image, label, deepLink });
    } catch (err) {
      // Частый случай — 403: пользователь заблокировал бота / не начинал диалог.
      logger.error({ err, telegramId }, "Failed to send lightbox photo to chat");
      throw new BadGatewayException({ error: "send_failed" });
    }
  }
}
