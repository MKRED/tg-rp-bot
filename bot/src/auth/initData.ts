import { parse, validate } from "@tma.js/init-data-node";
import type { TgUser } from "./auth.types.js";

export type InitDataAuthResult =
  | { ok: true; user: NonNullable<TgUser>; devBypass: boolean }
  | { ok: false; error: string; cause?: unknown };

export interface InitDataAuthOptions {
  botToken: string;
  /** Dev-обход для браузера без Telegram (в проде config.devUserId всегда undefined). */
  devUserId: number | undefined;
}

/**
 * Проверка Telegram Mini App initData — общая для Hono-middleware и guard'а Nest.
 *
 * Mini App шлёт подписанную строку в заголовке `Authorization: tma <initData>`. Доверяем
 * пользователю только после проверки HMAC-SHA256 по BOT_TOKEN (@tma.js/init-data-node).
 * Без заголовка: при заданном devUserId — фейковый пользователь с этим id, иначе отказ.
 * Логирование — на стороне вызывающего (у Hono и Nest свои ответы на отказ).
 */
export function authenticateInitData(
  authorization: string | undefined,
  { botToken, devUserId }: InitDataAuthOptions,
): InitDataAuthResult {
  const initDataRaw = authorization?.replace(/^tma\s+/i, "");

  if (!initDataRaw) {
    if (devUserId !== undefined) {
      return { ok: true, user: { id: devUserId, first_name: "Dev" }, devBypass: true };
    }
    return { ok: false, error: "Missing Telegram init data" };
  }

  try {
    // Бросает при неверной подписи или просроченных данных (по умолчанию expiresIn = 1 день).
    validate(initDataRaw, botToken);
  } catch (err) {
    return { ok: false, error: "Invalid Telegram init data", cause: err };
  }

  const user = parse(initDataRaw).user;
  // Подписанный initData без user бывает только при запуске не из чата с ботом — API без
  // пользователя не работает, это такой же отказ.
  if (!user) return { ok: false, error: "Invalid Telegram init data" };
  return { ok: true, user, devBypass: false };
}
