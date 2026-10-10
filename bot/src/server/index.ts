import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

// Каталог собранной статики Mini App относительно cwd процесса (в контейнере cwd = /app/bot,
// статика лежит в ./public). Локально в dev каталога нет — отдаётся 404, это нормально:
// в разработке webapp поднимается отдельным vite-сервером.
const WEBAPP_DIR = "./public";

/**
 * Legacy Hono-приложение: /health и раздача собранной статики webapp (всё API Mini App — в Nest).
 * Слушает не само — Nest передаёт сюда запросы через мост (legacyBridge.ts).
 */
export function createLegacyApp(): Hono {
  const app = new Hono();

  // Health-check для мониторинга/доступности
  app.get("/health", (c) => c.json({ ok: true }));

  // Неизвестный /api/* (вне префиксов Nest) — JSON 404, а не index.html от SPA-fallback ниже.
  app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

  // Статика Mini App: сначала отдаём реальные файлы (js/css/ассеты)…
  app.use("/*", serveStatic({ root: WEBAPP_DIR }));
  // …а на всё, что не нашлось как файл, — index.html (SPA-роутинг React)
  app.get("/*", serveStatic({ path: `${WEBAPP_DIR}/index.html` }));

  return app;
}

export { createLegacyBridge } from "./legacyBridge.js";
