import type { MiddlewareHandler } from "hono";
import { authenticateInitData } from "../../auth/initData.js";
import { config } from "../../config.js";
import logger from "../../logger.js";
import type { AppVariables } from "./initData.types.js";

/**
 * Валидация Telegram Mini App initData для legacy Hono-маршрутов. Сама проверка (подпись,
 * dev-обход) — в auth/initData.ts, общая с guard'ом Nest; здесь только ответ Hono и контекст
 * (`c.get("tgUser")`).
 */
export const requireInitData: MiddlewareHandler<{ Variables: AppVariables }> = async (c, next) => {
  const result = authenticateInitData(c.req.header("Authorization"), {
    botToken: config.botToken,
    devUserId: config.devUserId,
  });

  if (!result.ok) {
    // Клиентская ошибка (подделка/просрочка) — пишем в лог как warn, не error, и отклоняем.
    if (result.cause) logger.warn({ err: result.cause }, "Invalid Telegram initData rejected");
    return c.json({ error: result.error }, 401);
  }
  if (result.devBypass) logger.warn({ devUserId: result.user.id }, "Dev auth: initData bypassed");

  c.set("tgUser", result.user);
  await next();
};
