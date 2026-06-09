import { Bot } from "grammy";
import { config } from "./config.js";
import { createTelegramProxyAgent } from "./proxy.js";

/** Точный тип поля baseFetchConfig grammY-клиента. */
type FetchConfig = NonNullable<
  NonNullable<ConstructorParameters<typeof Bot>[1]>["client"]
>["baseFetchConfig"];

const agent = createTelegramProxyAgent();

// Страховочный таймаут запроса для node-fetch@2 (мс). Long polling grammY ждёт по умолчанию
// до 30с, поэтому берём с запасом — 50с. Назначение: зависший сокет (наблюдалось на первом
// холодном соединении через прокси/PuTTY-туннель) иначе стопорит поллер БЕЗ ошибки и навсегда —
// getUpdates не возвращается, апдейты не забираются. С таймаутом node-fetch прерывает запрос,
// grammY ловит сетевую ошибку (handlePollingError) и переподключается с бэкоффом.
const REQUEST_TIMEOUT_MS = 50_000;

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
