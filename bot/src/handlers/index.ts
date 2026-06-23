import type { Bot } from "grammy";
import { registerPhotoActions } from "./photoActions.js";
import { registerStart } from "./start.js";

/** Подключает все обработчики бота. Точка расширения для новых команд/хендлеров. */
export function registerHandlers(bot: Bot): void {
  registerStart(bot);
  registerPhotoActions(bot);
}
