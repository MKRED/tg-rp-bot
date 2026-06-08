import { Hono } from "hono";
import { requireInitData } from "./initData.js";

/**
 * Маршруты Mini App API под префиксом /api.
 *
 * Здесь же будет жить серверный вызов OpenRouter (chatCompletion) — ключ OpenRouter
 * НИКОГДА не попадает в браузер, поэтому RP-генерация идёт только через этот сервер,
 * а не напрямую из webapp.
 */
export function createApiRoutes(): Hono {
  const api = new Hono();

  // Все /api/* требуют Telegram initData (пока seam-заглушка, см. initData.ts)
  api.use("*", requireInitData);

  // Заглушка: профиль текущего пользователя. Реальные данные появятся после валидации initData.
  api.get("/me", (c) => c.json({ ok: true, user: null }));

  // TODO: api.post("/chat", ...) → chatCompletion(...) из ../llm

  return api;
}
