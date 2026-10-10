import { ProxyAgent } from "undici";
import { config } from "../config.js";
import logger from "../logger.js";

/**
 * Диспетчер для запросов к Tavily. Tavily (как и Telegram) недоступен напрямую из сети сервера —
 * прямой запрос падает "403 Forbidden" от awselb ещё до приложения. Переиспользуем тот же HTTP-прокси,
 * что и grammY-клиент (config.telegramProxyUrl, см. telegram/telegram-proxy.ts), но через undici
 * ProxyAgent: встроенный fetch на dispatcher из npm-пакета undici не заводится (внутри Node — своя,
 * несовместимая версия undici), поэтому TavilyService зовёт fetch из самого пакета undici.
 * DeepSeek при этом по-прежнему идёт напрямую, без прокси.
 */
export function createTavilyDispatcher(): ProxyAgent | undefined {
  if (!config.telegramProxyUrl) return undefined;
  logger.info({ proxy: config.telegramProxyUrl }, "Tavily requests routed through HTTP proxy");
  return new ProxyAgent(config.telegramProxyUrl);
}
