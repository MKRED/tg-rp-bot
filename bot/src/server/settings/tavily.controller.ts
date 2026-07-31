import { Hono } from "hono";
import { getDecryptedTavilyKey, getUserTavilySettings, upsertUserTavilySettings } from "../../db/userTavilySettings.js";
import { ensureUser } from "../../db/users.js";
import { TavilyHttpError } from "../../tavily/errors.js";
import { getTavilyUsage } from "../../tavily/tavilyUsage.js";
import logger from "../../logger.js";
import type { AppVariables } from "../middleware/initData.types.js";
import { INVALID_KEY_FORMAT_RESPONSE, isValidKeyFormat } from "./validation.js";

/**
 * Роуты под /api/settings/tavily — персональный ключ Tavily пользователя (BYOK, веб-поиск).
 * Монтируются ПОСЛЕ requireInitData (routes.ts), поэтому c.get("tgUser") доступен.
 */
export function createTavilySettingsRoutes(): Hono<{ Variables: AppVariables }> {
  const api = new Hono<{ Variables: AppVariables }>();

  // Статус ключа (без самого ключа) — для экрана настроек.
  api.get("/tavily", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    try {
      return c.json(await getUserTavilySettings(user.id));
    } catch (err) {
      logger.error({ err, userId: user.id }, "Failed to load user Tavily settings");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // Проверяет ключ и заодно возвращает квоту (у Tavily нет отдельного эндпоинта верификации —
  // валидный ответ GET /usage сам по себе означает валидный ключ). apiKey в теле — ключ ещё не
  // сохранён; без apiKey — реверификация уже сохранённого (расшифровывается на сервере).
  api.post("/tavily/verify", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const body = (await c.req.json().catch(() => ({}))) as { apiKey?: unknown };
    const typedKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

    try {
      const apiKey = typedKey || (await getDecryptedTavilyKey(user.id));
      if (!apiKey) return c.json({ ok: false, error: "no_key" });
      const usage = await getTavilyUsage(apiKey);
      return c.json({ ok: true, usage });
    } catch (err) {
      if (err instanceof TavilyHttpError && err.status === 401) {
        return c.json({ ok: false, error: "invalid_key" });
      }
      logger.error({ err, userId: user.id }, "Failed to verify Tavily key");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // Сохраняет/удаляет ключ. apiKey: null — удалить.
  api.patch("/tavily", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const body = (await c.req.json().catch(() => ({}))) as { apiKey?: unknown };

    const patch: { apiKey?: string | null } = {};
    if (body.apiKey === null) {
      patch.apiKey = null;
    } else if (typeof body.apiKey === "string") {
      const trimmed = body.apiKey.trim();
      if (!isValidKeyFormat(trimmed)) {
        return c.json(INVALID_KEY_FORMAT_RESPONSE, 400);
      }
      patch.apiKey = trimmed;
    }

    try {
      await ensureUser(user); // строка users должна существовать для FK user_settings
      return c.json(await upsertUserTavilySettings(user.id, patch));
    } catch (err) {
      logger.error({ err, userId: user.id }, "Failed to update user Tavily settings");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  return api;
}
