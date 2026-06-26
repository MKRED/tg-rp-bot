import { Hono } from "hono";
import { getLlmDebugSettings, upsertLlmDebugSettings } from "../db/userSettings.js";
import { ensureUser } from "../db/users.js";
import { cacheDebugSettings, clearDebugRecords, getDebugRecords } from "../llm/debugCapture.js";
import logger from "../logger.js";
import type { AppVariables } from "./initData.js";

/**
 * Отладочные роуты под /api/debug — просмотр RAW-запросов к LLM и управление перехватом.
 * Монтируются ПОСЛЕ requireInitData, поэтому c.get("tgUser") доступен. Всё изолировано по
 * владельцу: каждый видит и настраивает только свои запросы.
 */
export function createDebugRoutes(): Hono<{ Variables: AppVariables }> {
  const api = new Hono<{ Variables: AppVariables }>();

  // Текущие настройки перехвата + накопленные записи запросов пользователя.
  api.get("/llm", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    try {
      // БД — источник истины; синхронизируем in-memory кэш на случай рестарта без прайма.
      const settings = await getLlmDebugSettings(user.id);
      cacheDebugSettings(user.id, settings);
      return c.json({ settings, records: getDebugRecords(user.id) });
    } catch (err) {
      logger.error({ err, userId: user.id }, "Failed to load LLM debug data");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // Изменить настройки перехвата (тумблер и/или N). Частичный patch.
  api.patch("/llm/settings", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const body = (await c.req.json().catch(() => ({}))) as {
      enabled?: unknown;
      maxRequests?: unknown;
    };
    const patch: { enabled?: boolean; maxRequests?: number } = {};
    if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
    if (typeof body.maxRequests === "number") patch.maxRequests = body.maxRequests;
    try {
      await ensureUser(user); // строка users должна существовать для FK user_settings
      const settings = await upsertLlmDebugSettings(user.id, patch);
      cacheDebugSettings(user.id, settings); // кэш горячего пути — в ногу с БД
      return c.json({ settings });
    } catch (err) {
      logger.error({ err, userId: user.id }, "Failed to update LLM debug settings");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // Очистить накопленные записи пользователя (настройки не трогаем).
  api.delete("/llm/records", (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    clearDebugRecords(user.id);
    return c.json({ ok: true });
  });

  return api;
}
