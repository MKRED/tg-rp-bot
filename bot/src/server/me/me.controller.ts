import { Hono } from "hono";
import logger from "../../logger.js";
import type { AppVariables } from "../middleware/initData.types.js";
import { sendLightboxPhoto } from "../media/photoToChat.js";
import { getProfilePhotoDataUrl } from "../media/profilePhoto.js";
import { MAX_IMAGE_FULL_CHARS } from "../shared/imageValidation.constants.js";
import { parseImageField } from "../shared/imageValidation.js";
import { DEEP_LINK_RE, MAX_BUTTON_LABEL } from "./me.constants.js";

/**
 * Роуты текущего пользователя под /api/me. Монтируются ПОСЛЕ requireInitData, поэтому
 * c.get("tgUser") уже доступен (в dev без подписи будет undefined — учтено в хендлерах).
 */
export function createMeRoutes(): Hono<{ Variables: AppVariables }> {
  const api = new Hono<{ Variables: AppVariables }>();

  // Профиль текущего пользователя — из проверенного initData (в dev без подписи будет undefined).
  api.get("/", (c) => c.json({ ok: true, user: c.get("tgUser") ?? null }));

  // Фото профиля как data URL (или null). initData его не содержит при запуске кнопкой/меню,
  // поэтому берём серверно через Bot API. Аватар некритичен — на любой сбой отдаём null,
  // webapp покажет заглушку с инициалами, а не ошибку.
  api.get("/photo", async (c) => {
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
  api.post("/send-photo", async (c) => {
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

  return api;
}
