import { Hono } from "hono";
import type { AppVariables } from "../middleware/initData.types.js";
import { createSettingsRoutes as createLlmSettingsRoutes } from "./settings.controller.js";
import { createTavilySettingsRoutes } from "./tavily.controller.js";
import { createTranslateSettingsRoutes } from "./translate.controller.js";

/**
 * Публичная поверхность домена «настройки пользователя» для роутера (routes.ts), смонтирована
 * под /api/settings. Собирает подроутеры per-провайдер (/llm* — DeepSeek, /tavily* — веб-поиск,
 * /translate* — дефолты режима перевода PromptEditorOverlay) — каждый в своём файле, т.к. это
 * разные BYOK-ish сущности с разной формой данных.
 */
export function createSettingsRoutes(): Hono<{ Variables: AppVariables }> {
  const api = new Hono<{ Variables: AppVariables }>();
  api.route("/", createLlmSettingsRoutes());
  api.route("/", createTavilySettingsRoutes());
  api.route("/", createTranslateSettingsRoutes());
  return api;
}
