import { Bot } from "grammy";
import { config } from "./config.js";
import { createTelegramProxyAgent } from "./proxy.js";

/** Точный тип поля baseFetchConfig grammY-клиента. */
type FetchConfig = NonNullable<
  NonNullable<ConstructorParameters<typeof Bot>[1]>["client"]
>["baseFetchConfig"];

const agent = createTelegramProxyAgent();

// agent кладём в baseFetchConfig grammY-клиента — так прокси действует только на Telegram.
// baseFetchConfig типизирован под нативный fetch (где поля `agent` нет), а реально grammY
// использует node-fetch@2, который `agent` понимает. Поэтому каст к точному типу поля;
// корректность проксирования проверена рантайм-тестом (см. историю proxy-check).
export const bot = new Bot(config.botToken, {
  client: {
    baseFetchConfig: (agent ? { agent } : undefined) as FetchConfig,
  },
});
