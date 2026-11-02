import type { WebSearchResult } from "@tg-rp-bot/shared";

// Результат поиска сохраняется на категории карточки и уезжает в webapp — тип живёт в контракте.
export type { WebSearchResult };

/**
 * Кто умеет искать в вебе от имени пользователя — WebSearchService с уже подставленным ключом DeepSeek.
 * Цикл tool-calling генерации карточек получает его параметром (как ChatCompleter для LLM): ключ
 * читает вызывающий сервис, а в тестах вместо DeepSeek подставляется простой фейк.
 */
export interface WebSearcher {
  search(query: string): Promise<WebSearchResult[]>;
}
