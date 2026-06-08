import { type Bot, InlineKeyboard } from "grammy";
import { config } from "../config.js";
import { db, schema } from "../db/index.js";
import logger from "../logger.js";

/** Регистрирует обработчик команды /start. */
export function registerStart(bot: Bot): void {
  bot.command("start", async (ctx) => {
    const from = ctx.from;
    if (!from) return;

    try {
      // upsert пользователя: при первом /start создаём, при повторном — обновляем профиль
      const t0 = Date.now();
      await db
        .insert(schema.users)
        .values({
          id: from.id,
          username: from.username,
          firstName: from.first_name,
          lastName: from.last_name,
          languageCode: from.language_code,
        })
        .onConflictDoUpdate({
          target: schema.users.id,
          set: {
            username: from.username,
            firstName: from.first_name,
            lastName: from.last_name,
            languageCode: from.language_code,
            updatedAt: new Date(),
          },
        });
      logger.info({ durationMs: Date.now() - t0, userId: from.id }, "User upserted on /start");

      // Кнопка запуска Mini App показывается только если задан публичный HTTPS-URL
      const keyboard = config.webAppUrl
        ? new InlineKeyboard().webApp("🎭 Открыть RP", config.webAppUrl)
        : undefined;

      await ctx.reply(
        `Привет, ${from.first_name}! Это RP-бот.\n\n` +
          (config.webAppUrl
            ? "Нажми кнопку ниже, чтобы открыть интерфейс ролевой игры."
            : "Mini App ещё не подключён — задай WEBAPP_URL в .env."),
        { reply_markup: keyboard },
      );
    } catch (err) {
      // Личный чат: ошибку логируем и уведомляем пользователя
      logger.error({ err, userId: from.id }, "Failed to handle /start");
      await ctx.reply("Упс, что-то пошло не так. Попробуй ещё раз позже.").catch(() => {});
    }
  });
}
