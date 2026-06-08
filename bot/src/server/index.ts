import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { config } from "../config.js";
import logger from "../logger.js";
import { createApiRoutes } from "./routes.js";

/** Поднимает HTTP-сервер, обслуживающий API для Telegram Mini App. */
export function startServer(): void {
  const app = new Hono();

  // Health-check для мониторинга/доступности
  app.get("/health", (c) => c.json({ ok: true }));

  // API Mini App
  app.route("/api", createApiRoutes());

  serve({ fetch: app.fetch, port: config.port }, (info) => {
    logger.info({ port: info.port }, "HTTP server (Mini App API) started");
  });
}
