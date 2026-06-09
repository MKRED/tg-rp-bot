import { Hono } from "hono";
import logger from "../logger.js";
import { type AppVariables, requireInitData } from "./initData.js";
import { getProfilePhotoDataUrl } from "./profilePhoto.js";

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

  // Фото профиля как data URL (или null). initData его не содержит при запуске кнопкой/меню,
  // поэтому берём серверно через Bot API. Аватар некритичен — на любой сбой отдаём null,
  // webapp покажет заглушку с инициалами, а не ошибку.
  api.get("/me/photo", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ dataUrl: null }); // dev без initData
    try {
      const dataUrl = await getProfilePhotoDataUrl(user.id);
      return c.json({ dataUrl });
    } catch (err) {
      logger.error({ err, userId: user.id }, "Failed to fetch profile photo");
      return c.json({ dataUrl: null });
    }
  });

  // TODO: api.post("/chat", ...) → chatCompletion(...) из ../llm

  return api;
}
