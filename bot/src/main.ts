import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import { config } from "./config.js";
import logger from "./logger.js";
import { serveWebapp } from "./webapp-static/serve-webapp.js";

// Лимит JSON-тела: в Express по умолчанию 100 КБ, а персонаж несёт миниатюру (до 900 тыс. символов)
// и полное фото (до 2,5 млн) data URL'ами — см. common/image-limits.ts.
const JSON_BODY_LIMIT = "8mb";

async function bootstrap(): Promise<void> {
  // bodyParser: false — подключаем только JSON-парсер со своим лимитом (urlencoded API не принимает).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  app.useLogger(app.get(Logger));
  app.useBodyParser("json", { limit: JSON_BODY_LIMIT });
  // /health — вне /api: его опрашивает мониторинг по прежнему адресу.
  app.setGlobalPrefix("api", { exclude: ["health"] });
  serveWebapp(app);

  // SIGINT/SIGTERM → app.close(): хуки onApplicationShutdown (в т.ч. остановка long polling бота,
  // telegram/telegram-polling.service.ts). Сам бот стартует из onApplicationBootstrap внутри listen().
  app.enableShutdownHooks();
  await app.listen(config.port);
  logger.info({ port: config.port }, "HTTP server (Mini App API + webapp) started");
}

bootstrap().catch((err) => {
  logger.error({ err }, "Bootstrap failed");
  process.exit(1);
});
