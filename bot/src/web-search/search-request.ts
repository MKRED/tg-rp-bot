import type { WebSearchResult } from "@tg-rp-bot/shared";
import { SEARCH_MAX_RESULTS, SEARCH_QUERY_MAX_LENGTH, SEARCH_RESULT_MAX_CHARS } from "./web-search.constants.js";

/** Один результат POST /v1/tools/search — только поля, которые мы читаем. */
export interface DeepSeekSearchItem {
  title: string;
  url: string;
  /** Выжимка страницы для LLM-контекста (на практике ~2000 символов). */
  summary?: string | null;
  /** Короткий сниппет (~100–200 символов) — запасной вариант, если summary пуст. */
  snippet?: string | null;
}

/**
 * Тело запроса поиска. Запрос модели длиннее лимита DeepSeek обрезается, а не роняет вызов 400-й:
 * модель иногда пишет в query целое предложение, и основной смысл несёт его начало.
 * need_content: false — полный текст страниц не нужен, модели хватает summary.
 */
export function buildSearchBody(query: string): { query: string; count: number; need_content: false } {
  return {
    query: query.trim().slice(0, SEARCH_QUERY_MAX_LENGTH),
    count: SEARCH_MAX_RESULTS,
    need_content: false,
  };
}

/**
 * Ответ DeepSeek → контракт WebSearchResult (тот же {title,url,content}, что хранится в старых поисках
 * карточек). content обрезается до SEARCH_RESULT_MAX_CHARS — см. комментарий к константе.
 */
export function mapSearchResults(items: DeepSeekSearchItem[] | undefined): WebSearchResult[] {
  return (items ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    content: (r.summary || r.snippet || "").slice(0, SEARCH_RESULT_MAX_CHARS),
  }));
}
