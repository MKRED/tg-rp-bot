import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { listAllLlmDebugSettings } from "../db/userSettings.js";
import { primeDebugSettings } from "../llm/debugCapture.js";
import logger from "../logger.js";
import { createApiRoutes } from "./routes.js";

// Каталог собранной статики Mini App относительно cwd процесса (в контейнере cwd = /app/bot,
// статика лежит в ./public). Локально в dev каталога нет — отдаётся 404, это нормально:
// в разработке webapp поднимается отдельным vite-сервером.
const WEBAPP_DIR = "./public";

/**
 * Legacy Hono-приложение: ещё не перенесённое на Nest API Mini App + раздача собранной статики
 * webapp. Слушает не само — Nest передаёт сюда запросы через мост (legacyBridge.ts).
 */
export function createLegacyApp(): Hono {
  const app = new Hono();

  // Health-check для мониторинга/доступности
  app.get("/health", (c) => c.json({ ok: true }));

  // API Mini App — регистрируем ДО статики, чтобы catch-all ниже её не перехватывал
  app.route("/api", createApiRoutes());

  // Статика Mini App: сначала отдаём реальные файлы (js/css/ассеты)…
  app.use("/*", serveStatic({ root: WEBAPP_DIR }));
  // …а на всё, что не нашлось как файл, — index.html (SPA-роутинг React)
  app.get("/*", serveStatic({ path: `${WEBAPP_DIR}/index.html` }));

  return app;
}

/**
 * Прайм in-memory кэша настроек отладки из БД: перехват уважает сохранённый тумблер/N
 * ещё до первого открытия экрана. Fire-and-forget — на сбое перехват просто стартует с дефолтами.
 */
export function primeLlmDebugSettings(): void {
  listAllLlmDebugSettings()
    .then((rows) => primeDebugSettings(rows))
    .catch((err) => logger.warn({ err }, "Failed to prime LLM debug settings cache"));
}

export { createLegacyBridge } from "./legacyBridge.js";
