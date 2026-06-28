import { Bot } from "grammy";
import { REQUEST_TIMEOUT_MS } from "./bot.constants.js";
import { config } from "./config.js";
import { createTelegramProxyAgent } from "./proxy.js";

/** Точный тип поля baseFetchConfig grammY-клиента. */
type FetchConfig = NonNullable<
  NonNullable<ConstructorParameters<typeof Bot>[1]>["client"]
>["baseFetchConfig"];

// Прокси-агент Telegram. Экспортируем, чтобы скачивание файлов (фото профиля) шло через
// тот же прокси и тот же агент — без повторного создания/логирования на каждый запрос.
export const telegramProxyAgent = createTelegramProxyAgent();
const agent = telegramProxyAgent;

// agent кладём в baseFetchConfig grammY-клиента — так прокси действует только на Telegram.
// baseFetchConfig типизирован под нативный fetch (где нет ни `agent`, ни `timeout`), а реально
// grammY использует node-fetch@2, который обе опции понимает. Поэтому каст к точному типу поля;
// корректность проксирования проверена рантайм-тестом (см. историю proxy-check).
export const bot = new Bot(config.botToken, {
  client: {
    baseFetchConfig: {
      ...(agent ? { agent } : {}),
      timeout: REQUEST_TIMEOUT_MS,
    } as FetchConfig,
  },
});
