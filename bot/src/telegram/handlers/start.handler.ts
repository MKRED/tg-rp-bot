import { Injectable, type OnModuleInit } from "@nestjs/common";
import { Bot, InlineKeyboard } from "grammy";
import { config } from "../../config.js";
import logger from "../../logger.js";
import { UsersService } from "../../users/users.service.js";

/** Команда /start: заводит/обновляет пользователя и показывает кнопку запуска Mini App. */
@Injectable()
export class StartHandler implements OnModuleInit {
  constructor(
    private readonly bot: Bot,
    private readonly users: UsersService,
  ) {}

  onModuleInit(): void {
    this.bot.command("start", async (ctx) => {
      const from = ctx.from;
      if (!from) return;

      try {
        await this.users.saveTelegramProfile(from);
        logger.info({ userId: from.id }, "User saved on /start");

        // Кнопка запуска Mini App показывается только если задан публичный HTTPS-URL
        const keyboard = config.webAppUrl ? new InlineKeyboard().webApp("🎭 Открыть RP", config.webAppUrl) : undefined;

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
        await ctx
          .reply("Упс, что-то пошло не так. Попробуй ещё раз позже.")
          .catch((replyErr) => logger.warn({ err: replyErr, userId: from.id }, "Failed to send /start error reply"));
      }
    });
  }
}
