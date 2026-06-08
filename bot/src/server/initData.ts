import type { MiddlewareHandler } from "hono";
import { config } from "../config.js";
import logger from "../logger.js";

/**
 * SEAM для валидации Telegram Mini App initData.
 *
 * Mini App шлёт подписанную строку initData; её нужно проверять HMAC-SHA256 по BOT_TOKEN
 * и только тогда доверять переданному пользователю. Здесь — заглушка, фиксирующая границу:
 * подпись пока НЕ проверяется.
 *
 * TODO перед публичным запуском: реализовать проверку (например, @telegram-apps/init-data-node)
 * и класть распарсенного пользователя в контекст запроса (c.set("tgUser", ...)).
 */
export const requireInitData: MiddlewareHandler = async (c, next) => {
  const header = c.req.header("Authorization");
  const initDataRaw = header?.replace(/^tma\s+/i, "");

  if (!initDataRaw) {
    // В проде без initData запрос отклоняем; в dev пропускаем, чтобы не мешать отладке.
    if (config.isProduction) {
      return c.json({ error: "Missing Telegram init data" }, 401);
    }
    logger.warn("Request without initData allowed (dev mode)");
  }

  await next();
};
