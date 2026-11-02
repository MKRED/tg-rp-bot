/** Маршрут веб-поиска DeepSeek (raw JSON, не часть OpenAI-схемы) — тот же хост, что у LLM. */
export const DEEPSEEK_SEARCH_URL = "https://api.deepseek.com/v1/tools/search";

/** Сколько результатов веб-поиска отдаём модели за один вызов web_search (цена от count не зависит). */
export const SEARCH_MAX_RESULTS = 5;

/**
 * Сколько символов выжимки страницы оставляем в одном результате. summary у DeepSeek ~2000 символов, а
 * поиски хранятся на категории и реплеятся в промпт этого и всех следующих блоков (tool-context.ts) —
 * без обрезки 5 результатов × до 8 раундов раздували бы контекст каждой генерации.
 */
export const SEARCH_RESULT_MAX_CHARS = 1000;

/** Лимит длины query у DeepSeek (1–128 символов) — длиннее API отклонит с 400. */
export const SEARCH_QUERY_MAX_LENGTH = 128;
