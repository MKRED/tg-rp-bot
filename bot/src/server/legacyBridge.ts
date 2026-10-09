import { getRequestListener } from "@hono/node-server";
import type { NextFunction, Request, Response } from "express";
import type { Hono } from "hono";
import logger from "../logger.js";

/**
 * Префиксы, уже перенесённые на Nest. Всё остальное (ещё не перенесённое API, /health, статика
 * Mini App) уходит в legacy Hono. Домен добавляется сюда в том же коммите, где его маршруты
 * появляются в Nest и удаляются из server/routes.ts.
 */
export const NEST_ROUTE_PREFIXES: readonly string[] = [
  "/api/characters",
  "/api/personas",
  "/api/presets",
  "/api/rp-templates",
  "/api/narrator-templates",
  "/api/cards",
  "/api/settings",
  "/api/debug",
  "/api/translate",
  "/api/avatars",
  "/api/me",
];

/** Обслуживает ли путь Nest: точное совпадение с префиксом или вложенный путь под ним. */
export function isNestRoute(path: string, prefixes: readonly string[] = NEST_ROUTE_PREFIXES): boolean {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/**
 * Express-middleware переходного периода: отдаёт в Hono запросы вне NEST_ROUTE_PREFIXES.
 *
 * Монтируется через app.use(fn) БЕЗ пути (с путём Express переписал бы req.url, и Hono увидел бы
 * обрезанный адрес) и ДО body-parser Nest — иначе парсер вычитал бы поток тела, и Hono получил бы
 * пустой body.
 */
export function createLegacyBridge(app: Hono) {
  const listener = getRequestListener(app.fetch);
  return (req: Request, res: Response, next: NextFunction): void => {
    if (isNestRoute(req.path)) {
      next();
      return;
    }
    listener(req, res).catch((err: unknown) => {
      logger.error({ err, method: req.method, path: req.path }, "Legacy Hono request failed");
      if (!res.headersSent) res.status(500).json({ error: "Internal error" });
    });
  };
}
