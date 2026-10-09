import { Hono } from "hono";
import { createChatRoutes } from "./chats/index.js";
import { type AppVariables } from "./middleware/initData.types.js";
import { requireInitData } from "./middleware/initData.js";
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

  // Персонажи, персоны, пресеты, RP- и narrator-шаблоны, карточки, настройки, отладку, безэнтитный
  // перевод (/translate), батч-аватары (/avatars), текущего пользователя (/me) и книги знаний
  // (/books) обслуживает Nest (см. legacyBridge.ts).

  // RP-чаты: CRUD + стриминговая генерация + ветвление + перевод.
  api.route("/chats", createChatRoutes());

  // Narrator-режим («Режиссёр истории»): истории (книги знаний и шаблоны — в Nest).
  api.route("/stories", createStoryRoutes());

  return api;
}
