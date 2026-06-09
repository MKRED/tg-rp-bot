import { Hono } from "hono";
import { type AppVariables, requireInitData } from "./initData.js";

/**
 * Маршруты Mini App API под префиксом /api.
 *
 * Здесь же будет жить серверный вызов OpenRouter (chatCompletion) — ключ OpenRouter
 * НИКОГДА не попадает в браузер, поэтому RP-генерация идёт только через этот сервер,
 * а не напрямую из webapp.
 */
export function createApiRoutes(): Hono<{ Variables: AppVariables }> {
  const api = new Hono<{ Variables: AppVariables }>();

  // Все /api/* требуют валидный Telegram initData (проверка подписи, см. initData.ts)
  api.use("*", requireInitData);

  // Профиль текущего пользователя — из проверенного initData (в dev без подписи будет undefined).
  api.get("/me", (c) => c.json({ ok: true, user: c.get("tgUser") ?? null }));

  // TODO: api.post("/chat", ...) → chatCompletion(...) из ../llm

  return api;
}
