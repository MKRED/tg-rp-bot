/** DI-токен undici-диспетчера для запросов к Tavily (ProxyAgent или undefined, если прокси не задан). */
export const TAVILY_DISPATCHER = Symbol("TAVILY_DISPATCHER");

export const TAVILY_API_URL = "https://api.tavily.com";

/** Сколько результатов веб-поиска отдаём модели за один вызов web_search. */
export const SEARCH_MAX_RESULTS = 5;
