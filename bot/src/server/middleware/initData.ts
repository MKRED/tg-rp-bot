import { parse, validate } from "@tma.js/init-data-node";
import type { MiddlewareHandler } from "hono";
import { config } from "../../config.js";
import logger from "../../logger.js";
import type { AppVariables, TgUser } from "./initData.types.js";

/** Фейковый пользователь для dev-обхода — минимум полей, требуемых типом TgUser. */
function makeDevUser(id: number): TgUser {
  return { id, first_name: "Dev" };
}

/**
 * Валидация Telegram Mini App initData.
 *
 * Mini App шлёт подписанную строку initData в заголовке `Authorization: tma <initData>`.
 * Проверяем её HMAC-SHA256 по BOT_TOKEN (@tma.js/init-data-node) и только тогда доверяем
 * переданному пользователю, кладя его в контекст (`c.get("tgUser")`).
 *
 * Без подписи: если задан config.devUserId (dev-обход для браузера без Telegram) —
 * подставляем фейкового пользователя с этим id, иначе 401.
 */
export const requireInitData: MiddlewareHandler<{ Variables: AppVariables }> = async (c, next) => {
  const header = c.req.header("Authorization");
  const initDataRaw = header?.replace(/^tma\s+/i, "");

  if (!initDataRaw) {
    if (config.devUserId !== undefined) {
      logger.warn({ devUserId: config.devUserId }, "Dev auth: initData bypassed");
      c.set("tgUser", makeDevUser(config.devUserId));
      await next();
      return;
    }
    return c.json({ error: "Missing Telegram init data" }, 401);
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
