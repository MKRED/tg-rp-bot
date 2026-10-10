import { Bot } from "grammy";
import type { HttpsProxyAgent } from "https-proxy-agent";
import { config } from "../config.js";
import { REQUEST_TIMEOUT_MS } from "./telegram.constants.js";

/** Точный тип поля baseFetchConfig grammY-клиента. */
type FetchConfig = NonNullable<
  NonNullable<ConstructorParameters<typeof Bot>[1]>["client"]
>["baseFetchConfig"];

/**
 * Экземпляр бота grammY (провайдер Nest под токеном-классом Bot).
 *
 * agent кладём в baseFetchConfig grammY-клиента — так прокси действует только на Telegram.
 * baseFetchConfig типизирован под нативный fetch (где нет ни `agent`, ни `timeout`), а реально
 * grammY использует node-fetch@2, который обе опции понимает. Поэтому каст к точному типу поля;
 * корректность проксирования проверена рантайм-тестом (docs/architecture.md, раздел о прокси).
 */
export function createTelegramBot(agent: HttpsProxyAgent<string> | undefined): Bot {
  return new Bot(config.botToken, {
    client: {
      baseFetchConfig: {
        ...(agent ? { agent } : {}),
        timeout: REQUEST_TIMEOUT_MS,
      } as FetchConfig,
    },
  });
}
