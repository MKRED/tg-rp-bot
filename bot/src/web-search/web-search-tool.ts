import type { ToolDefinition } from "../llm/types.js";
import {
  SEARCH_MAX_RESULTS,
  SEARCH_QUERY_MAX_LENGTH,
} from "./web-search.constants.js";

export const WEB_SEARCH_TOOL_NAME = "web_search";

/**
 * Схема инструмента для tool_choice: "auto" — модель сама решает, когда искать, поэтому правило
 * «когда» живёт здесь, а не в системном промпте: инструмент предлагается модели только когда поиск
 * доступен, и описание всегда правдиво. Акцент на «проверь, а не вспоминай»: в генерации карточек
 * модель уверена в своём знании канона и без явного разрешения почти не ищет, а ошибки в каноне —
 * как раз там. Граница «не нужно» снимает обратный перекос — поиск ради оригинальных персонажей.
 *
 * searchesLeft — остаток бюджета на старте цикла: зная его заранее, модель распределяет запросы, а не
 * выпускает в первом же ходе больше параллельных вызовов, чем выполнится. Внутри цикла число не
 * меняется (схема — часть кэшируемого префикса), текущий остаток приходит в каждом результате.
 */
export function webSearchTool(searchesLeft: number): ToolDefinition {
  return {
    type: "function",
    function: {
      name: WEB_SEARCH_TOOL_NAME,
      description:
        `Searches the web and returns up to ${SEARCH_MAX_RESULTS} results (title, url, summary). ` +
        "Use it BEFORE writing whenever the brief refers to an existing work or the real world — a franchise, " +
        "anime, game, book, film, real person, historical period, place or culture — and the block depends on " +
        "its facts (canon appearance, abilities, relationships, events, terminology). Look such facts up " +
        "instead of recalling them: a search is cheap, while a wrong canon detail ruins the card. Several " +
        "searches in one turn are fine. Not needed for purely original characters or for creative choices " +
        "the brief leaves open. " +
        `Budget for this block: ${searchesLeft} searches in total — each result reports searches_left.`,
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              `Short keyword query, max ${SEARCH_QUERY_MAX_LENGTH} chars: the work's English or original title + ` +
              'the subject. One topic per query. Example: "Frieren Fern appearance outfit"',
          },
        },
        required: ["query"],
      },
    },
  };
}
