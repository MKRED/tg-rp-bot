import { Injectable } from "@nestjs/common";
import logger from "../logger.js";
import { retry } from "../utils/index.js";
import { WebSearchHttpError } from "./errors.js";
import { buildSearchBody, type DeepSeekSearchItem, mapSearchResults } from "./search-request.js";
import { DEEPSEEK_SEARCH_URL } from "./web-search.constants.js";
import type { WebSearchResult } from "./web-search.types.js";

/**
 * Веб-поиск DeepSeek (POST /v1/tools/search) с ключом DeepSeek пользователя (BYOK) — отдельного ключа
 * поиска нет. Ключ — параметром вызова: его читает вызывающий сервис (генерация карточек). Запрос
 * идёт обычным fetch напрямую, без прокси — тот же хост, что у LLM-вызовов (см. llm/chat-completions/client.ts).
 * Тарифицируется только успешный непустой ответ; 402 — на аккаунте кончился баланс.
 */
@Injectable()
export class WebSearchService {
  async search(apiKey: string, query: string): Promise<WebSearchResult[]> {
    const t0 = Date.now();
    const body = buildSearchBody(query);
    const data = await retry(
      async () => {
        const response = await fetch(DEEPSEEK_SEARCH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new WebSearchHttpError(response.status, text);
        }
        return (await response.json()) as { results?: DeepSeekSearchItem[] };
      },
      3,
      1500,
      "deepseek.search",
      // Повторяем только 5xx/429/408 и сетевые сбои — прочие 4xx (ключ, баланс, битый запрос) сразу наверх.
      (err) =>
        err instanceof WebSearchHttpError ? err.status >= 500 || err.status === 429 || err.status === 408 : true,
    );
    const results = mapSearchResults(data.results);
    logger.info(
      { durationMs: Date.now() - t0, query: body.query, resultsCount: results.length },
      "DeepSeek search done",
    );
    return results;
  }
}
