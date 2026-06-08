import type { Bot } from "grammy";
import { registerStart } from "./start.js";

/** Подключает все обработчики бота. Точка расширения для новых команд/хендлеров. */
export function registerHandlers(bot: Bot): void {
  registerStart(bot);
}
