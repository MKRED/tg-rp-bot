import { existsSync } from "node:fs";
import path from "node:path";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { NextFunction, Request, Response } from "express";
import logger from "../logger.js";
import { shouldServeSpaIndex } from "./spa-fallback.js";

/**
 * Каталог собранной статики Mini App относительно cwd процесса: в контейнере cwd = /app/bot, сборка
 * webapp лежит в ./public (Dockerfile). Локально каталога нет — в dev webapp отдаёт Vite.
 */
const WEBAPP_DIR = "./public";

/**
 * Раздача Mini App: сначала реальные файлы сборки (js/css/ассеты), затем index.html на маршруты
 * React-приложения. Подключается обычными Express-middleware ДО маршрутов Nest — поэтому fallback
 * сам пропускает /api и /health (shouldServeSpaIndex), и потому же это не контроллер: глобальный
 * guard отдал бы на страницу приложения 401.
 */
export function serveWebapp(app: NestExpressApplication): void {
  const root = path.resolve(WEBAPP_DIR);
  if (!existsSync(root)) {
    logger.info({ root }, "Webapp build not found — static serving disabled (dev: Vite)");
    return;
  }
  const index = path.join(root, "index.html");
  app.useStaticAssets(root);
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!shouldServeSpaIndex(req.method, req.path)) return next();
    res.sendFile(index, (err) => {
      if (!err) return;
      // Клиент оборвал соединение посреди ответа — не ошибка сервера, 500 в лог не нужен.
      if (res.headersSent) logger.debug({ err, path: req.path }, "Webapp index.html send aborted");
      else next(err);
    });
  });
  logger.info({ root }, "Serving webapp static files");
}
