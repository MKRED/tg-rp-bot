import { parse } from "@tma.js/init-data-node";

/** Распарсенный пользователь Telegram из проверенного initData. */
export type TgUser = ReturnType<typeof parse>["user"];

/** Переменные контекста Hono, которые проставляет middleware requireInitData. */
export type AppVariables = {
  /** Доверенный пользователь (есть только после успешной валидации подписи). */
  tgUser: TgUser;
};
