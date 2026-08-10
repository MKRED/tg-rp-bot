import { Hono } from "hono";
import { getUserTranslateSettings, upsertUserTranslateSettings } from "../../db/userTranslateSettings.js";
import { ensureUser } from "../../db/users.js";
import logger from "../../logger.js";
import type { AppVariables } from "../middleware/initData.types.js";
import { PROMPT_TRANSLATE_REASONING_LEVELS } from "../shared/translate.constants.js";

/**
 * Роуты под /api/settings/translate — настройки по умолчанию для режима перевода в
 * PromptEditorOverlay (движок, целевой язык, свой ИИ-промпт, reasoning). Не путать с
 * /api/settings/llm (ключ DeepSeek) или /chats,/stories translateMethod (per-чат/per-история) —
 * это отдельная, безэнтитная сущность (см. db/userTranslateSettings.ts).
 * Монтируются ПОСЛЕ requireInitData (routes.ts), поэтому c.get("tgUser") доступен.
 */
export function createTranslateSettingsRoutes(): Hono<{ Variables: AppVariables }> {
  const api = new Hono<{ Variables: AppVariables }>();

  api.get("/translate", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    try {
      return c.json(await getUserTranslateSettings(user.id));
    } catch (err) {
      logger.error({ err, userId: user.id }, "Failed to load user translate settings");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  api.patch("/translate", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);
    const body = (await c.req.json().catch(() => ({}))) as {
      engine?: unknown;
      targetLang?: unknown;
      promptTemplate?: unknown;
      reasoningEffort?: unknown;
    };

    const patch: {
      engine?: "google" | "ai";
      targetLang?: string;
      promptTemplate?: string | null;
      reasoningEffort?: string;
    } = {};
    if (body.engine === "google" || body.engine === "ai") patch.engine = body.engine;
    if (typeof body.targetLang === "string" && body.targetLang.trim()) patch.targetLang = body.targetLang.trim();
    if (body.promptTemplate === null) {
      patch.promptTemplate = null;
    } else if (typeof body.promptTemplate === "string") {
      patch.promptTemplate = body.promptTemplate;
    }
    if (
      typeof body.reasoningEffort === "string" &&
      PROMPT_TRANSLATE_REASONING_LEVELS.includes(
        body.reasoningEffort as (typeof PROMPT_TRANSLATE_REASONING_LEVELS)[number],
      )
    ) {
      patch.reasoningEffort = body.reasoningEffort;
    }

    try {
      await ensureUser(user); // строка users должна существовать для FK user_settings
      return c.json(await upsertUserTranslateSettings(user.id, patch));
    } catch (err) {
      logger.error({ err, userId: user.id }, "Failed to update user translate settings");
      return c.json({ error: "Internal error" }, 500);
    }
  });

  return api;
}
