import type { Bot } from "grammy";
import logger from "../logger.js";
import { PHOTO_CLOSE_CALLBACK } from "./photoActions.constants.js";

/**
 * Регистрирует обработчик инлайн-кнопки «Закрыть» под фото, которое пользователь отправил себе
 * в чат из лайтбокса Mini App. Нажатие удаляет сообщение с фото. Это личный чат, поэтому ошибку
 * удаления логируем и всё равно отвечаем на callback (иначе «часики» на кнопке зависнут).
 */
export function registerPhotoActions(bot: Bot): void {
  bot.callbackQuery(PHOTO_CLOSE_CALLBACK, async (ctx) => {
    try {
      await ctx.deleteMessage();
    } catch (err) {
      // Сообщение могло устареть (Telegram не даёт боту удалять старше 48ч) или быть уже удалённым.
      logger.warn({ err, userId: ctx.from?.id }, "Failed to delete lightbox photo message");
    } finally {
      // callback мог устареть (Bot API 400) — не критично, но не глотаем молча.
      await ctx
        .answerCallbackQuery()
        .catch((err) => logger.debug({ err, userId: ctx.from?.id }, "answerCallbackQuery failed"));
    }
  });
}
