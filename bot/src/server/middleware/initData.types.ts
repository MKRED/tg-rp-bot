import type { TgUser } from "../../auth/auth.types.js";

export type { TgUser };

/** Переменные контекста Hono, которые проставляет middleware requireInitData. */
export type AppVariables = {
  /** Доверенный пользователь (есть только после успешной валидации подписи). */
  tgUser: TgUser;
};
