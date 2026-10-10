import { Module } from "@nestjs/common";
import { Bot } from "grammy";
import { UsersModule } from "../users/users.module.js";
import { PhotoActionsHandler } from "./handlers/photo-actions.handler.js";
import { StartHandler } from "./handlers/start.handler.js";
import { createTelegramBot } from "./telegram-bot.factory.js";
import { TelegramPollingService } from "./telegram-polling.service.js";
import { createTelegramProxyAgent } from "./telegram-proxy.js";
import { TELEGRAM_PROXY_AGENT } from "./telegram.constants.js";

/**
 * Бот grammY внутри Nest: экземпляр Bot (токен-класс) и прокси-агент Telegram — провайдеры, их
 * получают обработчики и me/media (Bot API, скачивание файлов через тот же прокси).
 */
@Module({
  imports: [UsersModule],
  providers: [
    { provide: TELEGRAM_PROXY_AGENT, useFactory: createTelegramProxyAgent },
    { provide: Bot, useFactory: createTelegramBot, inject: [TELEGRAM_PROXY_AGENT] },
    TelegramPollingService,
    StartHandler,
    PhotoActionsHandler,
  ],
  exports: [Bot, TELEGRAM_PROXY_AGENT],
})
export class TelegramModule {}
