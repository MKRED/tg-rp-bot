import { Hono } from "hono";
import { createAvatarRoutes } from "./avatars/index.js";
import { createBookRoutes } from "./books/index.js";
import { createCharacterRoutes } from "./characters/index.js";
import { createChatRoutes } from "./chats/index.js";
import { createDebugRoutes } from "./debug/index.js";
import { createMeRoutes } from "./me/index.js";
import { type AppVariables } from "./middleware/initData.types.js";
import { requireInitData } from "./middleware/initData.js";
import { createNarratorTemplateRoutes } from "./narrator-templates/index.js";
import { createPersonaRoutes } from "./personas/index.js";
import { createPresetRoutes } from "./presets/index.js";
import { createRpTemplateRoutes } from "./rp-templates/index.js";
import { createStoryRoutes } from "./stories/index.js";

/**
 * Маршруты Mini App API под префиксом /api — карта всех эндпоинтов.
 *
 * Каждый домен — отдельный sub-app (контроллер), монтируемый здесь; реализация эндпоинтов
 * живёт в `<домен>/<домен>.controller.ts`. Серверный вызов LLM (chatCompletion) идёт ТОЛЬКО
 * отсюда: ключ провайдера никогда не попадает в браузер, поэтому RP-генерация идёт через сервер,
 * а не напрямую из webapp.
 */
export function createApiRoutes(): Hono<{ Variables: AppVariables }> {
  const api = new Hono<{ Variables: AppVariables }>();

  // Все /api/* требуют валидный Telegram initData (проверка подписи, см. middleware/initData.ts)
  api.use("*", requireInitData);

  // Текущий пользователь: профиль, фото профиля, отправка фото из лайтбокса в чат.
  api.route("/me", createMeRoutes());

  // CRUD персонажей / персон / пресетов / RP-шаблонов (sub-app наследует requireInitData выше).
  api.route("/characters", createCharacterRoutes());
  api.route("/personas", createPersonaRoutes());
  api.route("/presets", createPresetRoutes());
  api.route("/rp-templates", createRpTemplateRoutes());

  // Батч-резолв аватаров (AvatarStack в списке историй / шапке чата narrator).
  api.route("/avatars", createAvatarRoutes());

  // RP-чаты: CRUD + стриминговая генерация + ветвление + перевод.
  api.route("/chats", createChatRoutes());

  // Narrator-режим («Режиссёр истории»): книги знаний, шаблоны, истории.
  api.route("/books", createBookRoutes());
  api.route("/narrator-templates", createNarratorTemplateRoutes());
  api.route("/stories", createStoryRoutes());

  // Отладка: просмотр RAW-запросов к LLM и управление перехватом.
  api.route("/debug", createDebugRoutes());

  return api;
}
