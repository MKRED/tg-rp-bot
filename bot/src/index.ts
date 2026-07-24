import { bot } from "./bot.js";
import { config } from "./config.js";
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

if (config.botPolling) {
  // Запуск long polling. Прокси (если задан) уже встроен в bot.ts через baseFetchConfig.
  bot
    .start({
      onStart: (botInfo) => logger.info({ username: botInfo.username }, "Bot started (long polling)"),
    })
    .catch((err) => logger.error({ err }, "Long polling stopped unexpectedly"));
} else {
  logger.info("Long polling disabled (dev) — set BOT_POLLING=true чтобы включить");
}
