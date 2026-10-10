import { Injectable, type OnApplicationBootstrap, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import { type BotError, Bot } from "grammy";
import { config } from "../config.js";
import logger from "../logger.js";
import { STOP_TIMEOUT_MS } from "./telegram.constants.js";

/**
 * Жизненный цикл бота: обработчик ошибок, запуск long polling после инициализации модулей
 * (обработчики к этому моменту уже подключились в своих onModuleInit) и остановка при завершении
 * приложения (enableShutdownHooks в main.ts).
 */
@Injectable()
export class TelegramPollingService implements OnModuleInit, OnApplicationBootstrap, OnApplicationShutdown {
  // Сигнал мог прийти, пока start() ещё в bot.init (getMe): isRunning() тогда false, и без флага
  // polling запустился бы уже после закрытия приложения.
  private stopping = false;

  constructor(private readonly bot: Bot) {}

  onModuleInit(): void {
    // Без bot.catch grammY на любую ошибку в обработчике останавливает polling целиком и пробрасывает
    // её дальше — бот замолкает до рестарта. Обработчики сами отвечают пользователю, здесь — только лог.
    this.bot.catch((err: BotError) => {
      logger.error({ err: err.error, updateId: err.ctx.update.update_id, userId: err.ctx.from?.id }, "Unhandled error in bot handler");
    });
  }

  onApplicationBootstrap(): void {
    if (!config.botPolling) {
      logger.info("Long polling disabled (dev) — set BOT_POLLING=true чтобы включить");
      return;
    }
    // НЕ ждём: хук выполняется внутри app.listen до открытия порта, а start() резолвится только после
    // остановки polling. Недоступность Telegram/прокси не должна мешать подняться HTTP API.
    this.bot
      .start({
        onStart: (botInfo) => {
          logger.info({ username: botInfo.username }, "Bot started (long polling)");
          if (this.stopping) void this.stopBot();
        },
      })
      .catch((err) => logger.error({ err }, "Long polling stopped unexpectedly"));
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    logger.info({ signal }, "Shutting down");
    this.stopping = true;
    if (this.bot.isRunning()) await this.stopBot();
  }

  /**
   * stop() сохраняет offset апдейтов запросом getUpdates — он может упасть или зависнуть по сети (до
   * REQUEST_TIMEOUT_MS). Ждём не дольше STOP_TIMEOUT_MS: Docker шлёт SIGKILL через 10 с, а потеря
   * offset безвредна — апдейты лишь придут повторно.
   */
  private async stopBot(): Promise<void> {
    const t0 = Date.now();
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<"timeout">((resolve) => (timer = setTimeout(() => resolve("timeout"), STOP_TIMEOUT_MS)));
    try {
      const result = await Promise.race([this.bot.stop().then(() => "stopped" as const), timeout]);
      if (result === "timeout") logger.warn({ durationMs: Date.now() - t0 }, "Bot stop timed out");
      else logger.info({ durationMs: Date.now() - t0 }, "Bot stopped");
    } catch (err) {
      logger.error({ err }, "Bot stop failed");
    } finally {
      clearTimeout(timer);
    }
  }
}
