import { Hono } from "hono";
import logger from "../logger.js";
import { createBookRoutes } from "./books.js";
import { createCharacterRoutes } from "./characters.js";
import { createChatRoutes } from "./chats.js";
import { createDebugRoutes } from "./debug.js";
import { MAX_IMAGE_FULL_CHARS, parseImageField } from "./imageValidation.js";
import { type AppVariables, requireInitData } from "./initData.js";
import { createNarratorTemplateRoutes } from "./narratorTemplates.js";
import { createPersonaRoutes } from "./personas.js";
import { sendLightboxPhoto } from "./photoToChat.js";
import { createPresetRoutes } from "./presets.js";
import { getProfilePhotoDataUrl } from "./profilePhoto.js";
import { createStoryRoutes } from "./stories.js";

/** Разрешённые внутренние пути для кнопки-ссылки под фото (защита от подстановки внешних URL). */
const DEEP_LINK_RE = /^\/(characters|personas)\/\d+$/;
/** Потолок длины текста инлайн-кнопки Telegram. */
const MAX_BUTTON_LABEL = 64;

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

  // Отправка фото из лайтбокса Mini App себе в чат с ботом: само фото (data URL),
  // подпись-имя для кнопки-ссылки и deep-link на персонажа/персону. На мобильных скачивание
  // картинки из webview не работает — отправка в чат заменяет «скачать».
  api.post("/me/send-photo", async (c) => {
    const user = c.get("tgUser");
    if (!user) return c.json({ error: "Auth required" }, 401);

    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return c.json({ error: "Body must be an object" }, 400);

    // Картинка — обязательный data:image/*-URL (тот же лимит, что у полноразмерного фото).
    const imageParsed = parseImageField(body.image, MAX_IMAGE_FULL_CHARS, "Image");
    if ("error" in imageParsed) return c.json({ error: imageParsed.error }, 400);
    if (!imageParsed.value) return c.json({ error: "Image is required" }, 400);

    const label = typeof body.label === "string" ? body.label.trim().slice(0, MAX_BUTTON_LABEL) : "";
    if (!label) return c.json({ error: "Label is required" }, 400);

    const deepLink = typeof body.deepLink === "string" ? body.deepLink : "";
    if (!DEEP_LINK_RE.test(deepLink)) return c.json({ error: "Invalid deepLink" }, 400);

    try {
      await sendLightboxPhoto(user.id, { dataUrl: imageParsed.value, label, deepLink });
      return c.json({ ok: true });
    } catch (err) {
      // Частый случай — 403: пользователь заблокировал бота / не начинал диалог.
      logger.error({ err, userId: user.id }, "Failed to send lightbox photo to chat");
      return c.json({ error: "send_failed" }, 502);
    }
  });

  // CRUD персонажей (sub-app наследует requireInitData выше).
  api.route("/characters", createCharacterRoutes());

  // CRUD персон пользователя (sub-app наследует requireInitData выше).
  api.route("/personas", createPersonaRoutes());

  // CRUD пресетов настроек генерации (sub-app наследует requireInitData выше).
  api.route("/presets", createPresetRoutes());

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
