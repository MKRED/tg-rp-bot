import { parse, validate } from "@tma.js/init-data-node";
import type { MiddlewareHandler } from "hono";
import { config } from "../config.js";
import logger from "../logger.js";

/** Распарсенный пользователь Telegram из проверенного initData. */
export type TgUser = ReturnType<typeof parse>["user"];

/** Переменные контекста Hono, которые проставляет этот middleware. */
export type AppVariables = {
  /** Доверенный пользователь (есть только после успешной валидации подписи). */
  tgUser: TgUser;
};

/**
 * Валидация Telegram Mini App initData.
 *
 * Mini App шлёт подписанную строку initData в заголовке `Authorization: tma <initData>`.
 * Проверяем её HMAC-SHA256 по BOT_TOKEN (@tma.js/init-data-node) и только тогда доверяем
 * переданному пользователю, кладя его в контекст (`c.get("tgUser")`).
 *
 * Без подписи: в проде запрос отклоняем (401), в dev пропускаем — чтобы не мешать отладке
 * webapp из обычного браузера, где initData недоступен.
 */
export const requireInitData: MiddlewareHandler<{ Variables: AppVariables }> = async (c, next) => {
  const header = c.req.header("Authorization");
  const initDataRaw = header?.replace(/^tma\s+/i, "");

  if (!initDataRaw) {
    if (config.isProduction) {
      return c.json({ error: "Missing Telegram init data" }, 401);
    }
    logger.warn("Request without initData allowed (dev mode)");
    await next();
    return;
  }

  try {
    // Бросает при неверной подписи или просроченных данных (по умолчанию expiresIn = 1 день).
    validate(initDataRaw, config.botToken);
  } catch (err) {
    // Клиентская ошибка (подделка/просрочка) — пишем в лог как warn, не error, и отклоняем.
    logger.warn({ err }, "Invalid Telegram initData rejected");
    return c.json({ error: "Invalid Telegram init data" }, 401);
  }

  // Подпись валидна — кладём распарсенного юзера в контекст для нижестоящих хендлеров.
  c.set("tgUser", parse(initDataRaw).user);
  await next();
};
