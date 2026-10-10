export type { AuthCredentials, AuthSession } from "@tg-rp-bot/shared";

/** Как пользователь вошёл: Mini App (initData) или браузер (логин и пароль, cookie сессии). */
export type AuthMode = "telegram" | "browser";
