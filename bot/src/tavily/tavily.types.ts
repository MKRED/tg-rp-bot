/** Один результат веб-поиска — в таком виде уходит модели в tool-результате web_search. */
export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
}

/** Квота ключа Tavily для экрана настроек. */
export interface TavilyUsage {
  plan: string;
  planUsage: number;
  planLimit: number | null;
}

/**
 * Кто умеет искать в вебе от имени пользователя — TavilyService с уже подставленным ключом.
 * Цикл tool-calling генерации карточек получает его параметром (как ChatCompleter для LLM): ключ
 * читает вызывающий сервис, а в тестах вместо Tavily подставляется простой фейк.
 */
export interface WebSearcher {
  search(query: string): Promise<WebSearchResult[]>;
}
