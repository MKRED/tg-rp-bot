import { bot } from "./bot.js";
import { registerHandlers } from "./handlers/index.js";
import logger from "./logger.js";
import { startServer } from "./server/index.js";

registerHandlers(bot);
startServer();

// Корректное завершение по сигналам ОС
const stop = () => {
  logger.info("Shutting down");
  void bot.stop();
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

// Запуск long polling. Прокси (если задан) уже встроен в bot.ts через baseFetchConfig.
bot.start({
  onStart: (botInfo) => logger.info({ username: botInfo.username }, "Bot started (long polling)"),
});
