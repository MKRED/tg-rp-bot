import { HttpsProxyAgent } from "https-proxy-agent";
import { config } from "./config.js";
import logger from "./logger.js";

/**
 * Создаёт HTTP-прокси-агент для запросов к Telegram Bot API.
 *
 * grammY в Node использует node-fetch@2, который проксируется через option `agent`
 * (НЕ через undici `dispatcher` — тот node-fetch игнорирует). HttpsProxyAgent выполняет
 * CONNECT-туннелирование, поэтому HTTP-прокси корректно проксирует HTTPS-адрес
 * https://api.telegram.org.
 *
 * Тот же config.telegramProxyUrl (но уже через undici ProxyAgent, не HttpsProxyAgent — см.
 * tavily/tavilyUsage.ts) переиспользуется и для Tavily: оба сервиса недоступны напрямую с сети
 * сервера (голый fetch падает "403 Forbidden" от awselb ещё до приложения). LLM-провайдер
 * (DeepSeek) и прочие fetch идут напрямую — им прокси не нужен. Никогда не используем глобальный
 * прокси (env HTTPS_PROXY/ALL_PROXY) — это увело бы через прокси и LLM-трафик тоже.
 */
export function createTelegramProxyAgent(): HttpsProxyAgent<string> | undefined {
  if (!config.telegramProxyUrl) return undefined;
  logger.info({ proxy: config.telegramProxyUrl }, "Telegram requests routed through HTTP proxy");
  return new HttpsProxyAgent(config.telegramProxyUrl);
}
