import { Hono } from "hono";
import type { AppVariables } from "../middleware/initData.types.js";
import { createSettingsRoutes as createLlmSettingsRoutes } from "./settings.controller.js";
import { createTavilySettingsRoutes } from "./tavily.controller.js";

/**
 * Публичная поверхность домена «настройки пользователя» для роутера (routes.ts), смонтирована
 * под /api/settings. Собирает подроутеры per-провайдер (/llm* — DeepSeek, /tavily* — веб-поиск) —
 * каждый в своём файле, т.к. это разные BYOK-сущности с разной формой данных (модель vs квота).
 */
export function createSettingsRoutes(): Hono<{ Variables: AppVariables }> {
  const api = new Hono<{ Variables: AppVariables }>();
  api.route("/", createLlmSettingsRoutes());
  api.route("/", createTavilySettingsRoutes());
  return api;
}
