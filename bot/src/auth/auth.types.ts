import type { parse } from "@tma.js/init-data-node";
import type { Request } from "express";

/** Распарсенный пользователь Telegram из проверенного initData. */
export type TgUser = ReturnType<typeof parse>["user"];

/** Запрос после guard'а: внутренний id пользователя + профиль Telegram (только при входе из Mini App). */
export interface AuthenticatedRequest extends Request {
  /** Внутренний id (UUID), не Telegram id. */
  userId: string;
  /** undefined при входе по логину (браузер, cookie сессии). */
  tgUser?: NonNullable<TgUser>;
}
