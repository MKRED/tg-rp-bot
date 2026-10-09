import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import { bot } from "./bot.js";
import { config } from "./config.js";
import { registerHandlers } from "./handlers/index.js";
import logger from "./logger.js";
import { createLegacyApp, createLegacyBridge } from "./server/index.js";

// Лимит JSON-тела: в Express по умолчанию 100 КБ, а персонаж несёт миниатюру (до 900 тыс. символов)
// и полное фото (до 2,5 млн) data URL'ами — см. common/image-limits.ts.
const JSON_BODY_LIMIT = "8mb";

async function bootstrap(): Promise<void> {
  // bodyParser: false — парсер подключаем вручную ПОСЛЕ моста в Hono, иначе он вычитал бы тело
  // запросов, которые уходят в Hono.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  app.useLogger(app.get(Logger));
  app.use(createLegacyBridge(createLegacyApp()));
  app.useBodyParser("json", { limit: JSON_BODY_LIMIT });
  app.setGlobalPrefix("api");

  await app.listen(config.port);
  logger.info({ port: config.port }, "HTTP server (Mini App API + webapp) started");

  registerHandlers(bot);
  startBot();

  // Корректное завершение по сигналам ОС
  const stop = () => {
    logger.info("Shutting down");
    void bot.stop();
    app.close().catch((err) => logger.error({ err }, "HTTP server close failed"));
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

function startBot(): void {
  if (!config.botPolling) {
    logger.info("Long polling disabled (dev) — set BOT_POLLING=true чтобы включить");
    return;
  }
  // Запуск long polling. Прокси (если задан) уже встроен в bot.ts через baseFetchConfig.
  bot
    .start({
      onStart: (botInfo) => logger.info({ username: botInfo.username }, "Bot started (long polling)"),
    })
    .catch((err) => logger.error({ err }, "Long polling stopped unexpectedly"));
}

bootstrap().catch((err) => {
  logger.error({ err }, "Bootstrap failed");
  process.exit(1);
});
