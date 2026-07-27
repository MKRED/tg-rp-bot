import { Hono } from "hono";
import {
  getDecryptedDeepSeekCredentials,
  getUserLlmSettings,
  upsertUserLlmSettings,
} from "../../db/userLlmSettings.js";
import { ensureUser } from "../../db/users.js";
import { listDeepSeekModels } from "../../llm/deepseekModels.js";
import { LlmHttpError } from "../../llm/errors.js";
import logger from "../../logger.js";
import type { AppVariables } from "../middleware/initData.types.js";

const MAX_KEY_LENGTH = 200;
// Отклоняем пробелы/переводы строк внутри ключа — частый баг копипасты из мессенджера: ключ с "\n"
// уходит в Authorization-заголовок и undici бросает малопонятный "Invalid header value".
const INVALID_KEY_CHARS = /[\s\x00-\x1f]/;

/**
 * Роуты под /api/settings — персональные ключ/модель DeepSeek пользователя (BYOK). Монтируются
 * ПОСЛЕ requireInitData (routes.ts), поэтому c.get("tgUser") доступен. Изолировано по владельцу.
 */
export function createSettingsRoutes(): Hono<{ Variables: AppVariables }> {
  const api = new Hono<{ Variables: AppVariables }>();

  // Статус ключа/модели (без самого ключа) — для экрана настроек.
  api.get("/llm", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    try {
      return c.json(await getUserLlmSettings(user.id));
    } catch (err) {
      logger.error({ err, userId: user.id }, "Failed to load user LLM settings");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // Проверяет ключ и заодно возвращает список доступных моделей (один вызов DeepSeek /models).
  // apiKey в теле — ключ ещё не сохранён (юзер только что его ввёл); без apiKey — реверификация
  // уже сохранённого (расшифровывается на сервере).
  api.post("/llm/verify", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const body = (await c.req.json().catch(() => ({}))) as { apiKey?: unknown };
    const typedKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

    try {
      const apiKey = typedKey || (await getDecryptedDeepSeekCredentials(user.id))?.apiKey;
      // "Проверить" без введённого и без сохранённого ключа — не ошибка сервера, штатный исход
      // (кнопка обычно задизейблена на этот случай, но защищаемся и здесь). 200, не 400: это тот
      // же канал ok/error, что и invalid_key ниже — фронту не нужно различать транспорт и результат.
      if (!apiKey) return c.json({ ok: false, error: "no_key" });
      const models = await listDeepSeekModels(apiKey);
      return c.json({ ok: true, models });
    } catch (err) {
      if (err instanceof LlmHttpError && err.status === 401) {
        return c.json({ ok: false, error: "invalid_key" });
      }
      logger.error({ err, userId: user.id }, "Failed to verify DeepSeek key");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  // Сохраняет ключ и/или модель. apiKey: null — удалить ключ (сносит и модель, см. upsertUserLlmSettings).
  api.patch("/llm", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const body = (await c.req.json().catch(() => ({}))) as { apiKey?: unknown; model?: unknown };

    const patch: { apiKey?: string | null; model?: string } = {};
    if (body.apiKey === null) {
      patch.apiKey = null;
    } else if (typeof body.apiKey === "string") {
      const trimmed = body.apiKey.trim();
      if (!trimmed || INVALID_KEY_CHARS.test(trimmed) || trimmed.length > MAX_KEY_LENGTH) {
        return c.json(
          {
            error: "invalid_key_format",
            message: "Некорректный ключ: проверьте, не попали ли лишние пробелы или перевод строки.",
          },
          400,
        );
      }
      patch.apiKey = trimmed;
    }
    if (typeof body.model === "string" && body.model.trim()) patch.model = body.model.trim();

    try {
      await ensureUser(user); // строка users должна существовать для FK user_settings
      return c.json(await upsertUserLlmSettings(user.id, patch));
    } catch (err) {
      logger.error({ err, userId: user.id }, "Failed to update user LLM settings");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  return api;
}
