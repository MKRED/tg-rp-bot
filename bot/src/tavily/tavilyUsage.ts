import { ProxyAgent, fetch as undiciFetch } from "undici";
import { config } from "../config.js";
import logger from "../logger.js";
import { retry } from "../utils/index.js";
import { TavilyHttpError } from "./errors.js";

// Ответ Tavily GET /usage содержит ещё key.usage/limit и account.paygo_usage/paygo_limit —
// не берём их: экран настроек показывает только план и использование по нему, а не всю
// детализацию по типам запросов и pay-as-you-go остатку.
interface TavilyUsageResponse {
  account: {
    current_plan: string;
    plan_usage: number;
    plan_limit: number | null;
  };
}

export interface TavilyUsage {
  plan: string;
  planUsage: number;
  planLimit: number | null;
}

// Tavily (как и Telegram) недоступен напрямую из сети сервера — прямой запрос падает "403 Forbidden"
// от awselb ещё до приложения. Переиспользуем тот же HTTP-прокси, что и grammY-клиент для Telegram
// (config.telegramProxyUrl, см. proxy.ts) — вызываем fetch из самого пакета undici вместе с его
// ProxyAgent, т.к. встроенный fetch на dispatcher из npm undici не заводится (несовместимая версия
// undici внутри Node). DeepSeek при этом по-прежнему идёт напрямую, без прокси.
const tavilyDispatcher = config.telegramProxyUrl ? new ProxyAgent(config.telegramProxyUrl) : undefined;

/**
 * Квота Tavily для данного ключа. Отдельного эндпоинта верификации у Tavily нет — валидный ответ
 * GET /usage сам по себе означает валидный ключ (см. server/settings/tavily.controller.ts).
 */
export async function getTavilyUsage(apiKey: string): Promise<TavilyUsage> {
  const t0 = Date.now();
  const data = await retry<TavilyUsageResponse>(
    async () => {
      const response = await undiciFetch("https://api.tavily.com/usage", {
        headers: { Authorization: `Bearer ${apiKey}` },
        dispatcher: tavilyDispatcher,
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new TavilyHttpError(response.status, text);
      }
      return (await response.json()) as TavilyUsageResponse;
    },
    3,
    1500,
    "tavily.getUsage",
    (err) => (err instanceof TavilyHttpError ? err.status >= 500 || err.status === 429 : true),
  );

  logger.info(
    { durationMs: Date.now() - t0, plan: data.account.current_plan },
    "Tavily usage fetched",
  );
  return {
    plan: data.account.current_plan,
    planUsage: data.account.plan_usage,
    planLimit: data.account.plan_limit,
  };
}
