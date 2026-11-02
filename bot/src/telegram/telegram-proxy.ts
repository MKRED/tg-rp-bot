import { HttpsProxyAgent } from "https-proxy-agent";
import { config } from "../config.js";
import logger from "../logger.js";

/**
 * Создаёт HTTP-прокси-агент для запросов к Telegram Bot API.
 *
 * grammY в Node использует node-fetch@2, который проксируется через option `agent`
 * (НЕ через undici `dispatcher` — тот node-fetch игнорирует). HttpsProxyAgent выполняет
 * CONNECT-туннелирование, поэтому HTTP-прокси корректно проксирует HTTPS-адрес
 * https://api.telegram.org.
 *
 * Прокси нужен только Telegram — он недоступен напрямую из сети сервера. DeepSeek (LLM и веб-поиск)
 * и прочие fetch идут напрямую — им прокси не нужен. Никогда не используем глобальный
 * прокси (env HTTPS_PROXY/ALL_PROXY) — это увело бы через прокси и LLM-трафик тоже.
 */
export function createTelegramProxyAgent(): HttpsProxyAgent<string> | undefined {
  if (!config.telegramProxyUrl) return undefined;
  logger.info({ proxy: config.telegramProxyUrl }, "Telegram requests routed through HTTP proxy");
  return new HttpsProxyAgent(config.telegramProxyUrl);
}
