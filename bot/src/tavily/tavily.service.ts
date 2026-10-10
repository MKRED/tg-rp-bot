import { Inject, Injectable } from "@nestjs/common";
import { type ProxyAgent, fetch as undiciFetch, type RequestInit } from "undici";
import logger from "../logger.js";
import { retry } from "../utils/index.js";
import { TavilyHttpError } from "./errors.js";
import { SEARCH_MAX_RESULTS, TAVILY_API_URL, TAVILY_DISPATCHER } from "./tavily.constants.js";
import type { TavilyUsage, WebSearchResult } from "./tavily.types.js";

// Ответ GET /usage содержит ещё key.usage/limit и account.paygo_usage/paygo_limit — не берём их:
// экран настроек показывает только план и использование по нему, а не всю детализацию по типам
// запросов и pay-as-you-go остатку.
interface TavilyUsageResponse {
  account: { current_plan: string; plan_usage: number; plan_limit: number | null };
}

/**
 * Клиент Tavily API. Ключ — параметром каждого вызова, а не из настроек: проверка в настройках
 * идёт и по ещё не сохранённому, только что введённому ключу. Авторизация — Bearer (а не api_key в
 * теле) — форма, проверенная в проде через прокси.
 */
@Injectable()
export class TavilyService {
  constructor(@Inject(TAVILY_DISPATCHER) private readonly dispatcher: ProxyAgent | undefined) {}

  /** Веб-поиск для генерации карточек (function calling, см. cards/generation/tool-loop.ts). */
  async search(apiKey: string, query: string): Promise<WebSearchResult[]> {
    const t0 = Date.now();
    const data = await this.request<{ results: WebSearchResult[] }>(apiKey, "/search", "tavily.search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, max_results: SEARCH_MAX_RESULTS, include_answer: false }),
    });
    const results = data.results.map((r) => ({ title: r.title, url: r.url, content: r.content }));
    logger.info({ durationMs: Date.now() - t0, query, resultsCount: results.length }, "Tavily search done");
    return results;
  }

  /**
   * Квота ключа. Отдельного эндпоинта верификации у Tavily нет — валидный ответ GET /usage сам по
   * себе означает валидный ключ (см. settings/tavily/tavily-settings.service.ts).
   */
  async getUsage(apiKey: string): Promise<TavilyUsage> {
    const t0 = Date.now();
    const { account } = await this.request<TavilyUsageResponse>(apiKey, "/usage", "tavily.getUsage");
    logger.info({ durationMs: Date.now() - t0, plan: account.current_plan }, "Tavily usage fetched");
    return { plan: account.current_plan, planUsage: account.plan_usage, planLimit: account.plan_limit };
  }

  /** Запрос через прокси с ретраем: повторяем только 5xx/429 и сетевые сбои — 4xx (неверный ключ) сразу наверх. */
  private request<T>(apiKey: string, path: string, label: string, init: RequestInit = {}): Promise<T> {
    return retry<T>(
      async () => {
        const response = await undiciFetch(`${TAVILY_API_URL}${path}`, {
          ...init,
          headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${apiKey}` },
          dispatcher: this.dispatcher,
        });
        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new TavilyHttpError(response.status, text);
        }
        return (await response.json()) as T;
      },
      3,
      1500,
      label,
      (err) => (err instanceof TavilyHttpError ? err.status >= 500 || err.status === 429 : true),
    );
  }
}
