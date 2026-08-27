import { ProxyAgent, fetch as undiciFetch } from "undici";
import { config } from "../config.js";
import type { ToolDefinition } from "../llm/types.js";
import logger from "../logger.js";
import { retry } from "../utils/index.js";
import { TavilyHttpError } from "./errors.js";

// Тот же прокси, что и getTavilyUsage (см. tavilyUsage.ts) — Tavily недоступен напрямую с сети сервера.
const tavilyDispatcher = config.telegramProxyUrl ? new ProxyAgent(config.telegramProxyUrl) : undefined;

export const WEB_SEARCH_TOOL_NAME = "web_search";

/** Схема инструмента для tool_choice: "auto" — модель сама решает, когда искать. */
export const WEB_SEARCH_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: WEB_SEARCH_TOOL_NAME,
    description:
      "Searches the internet for up-to-date information (news, facts past the model's training cutoff, current details about a character/setting).",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
    },
  },
};

export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
}

/**
 * Веб-поиск Tavily для генерации карточек (function calling, см. server/cards/generation/toolLoop.ts).
 * Авторизация — Bearer, как в getTavilyUsage (tavilyUsage.ts), а не api_key в теле — это форма,
 * проверенная в проде через тот же прокси.
 */
export async function tavilySearch(apiKey: string, query: string): Promise<WebSearchResult[]> {
  const t0 = Date.now();
  const results = await retry<WebSearchResult[]>(
    async () => {
      const response = await undiciFetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, max_results: 5, include_answer: false }),
        dispatcher: tavilyDispatcher,
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new TavilyHttpError(response.status, text);
      }
      const data = (await response.json()) as { results: WebSearchResult[] };
      return data.results.map((r) => ({ title: r.title, url: r.url, content: r.content }));
    },
    3,
    1500,
    "tavily.search",
    (err) => (err instanceof TavilyHttpError ? err.status >= 500 || err.status === 429 : true),
  );

  logger.info({ durationMs: Date.now() - t0, query, resultsCount: results.length }, "Tavily search done");
  return results;
}
