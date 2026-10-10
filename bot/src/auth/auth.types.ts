import type { parse } from "@tma.js/init-data-node";
import type { Request } from "express";

/** Распарсенный пользователь Telegram из проверенного initData. */
export type TgUser = ReturnType<typeof parse>["user"];

/** Запрос после guard'а: внутренний id пользователя + профиль Telegram, из которого он получен. */
export interface AuthenticatedRequest extends Request {
  /** Внутренний id (UUID), не Telegram id. */
  userId: string;
  tgUser: NonNullable<TgUser>;
}
