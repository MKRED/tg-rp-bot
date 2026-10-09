import type { PromptTranslateEngine } from "./settings.js";

/** Максимум абзацев в одном запросе POST /api/translate/text. */
export const MAX_TRANSLATE_BLOCKS_PER_REQUEST = 500;

/**
 * Тело POST /api/translate/text — безэнтитный батч-перевод абзацев (режим перевода в
 * PromptEditorOverlay). Движок — тот же выбор, что в настройках перевода пользователя.
 */
export interface TranslateTextRequest {
  blocks: string[];
  sourceLang: string;
  targetLang: string;
  mode: PromptTranslateEngine;
}

/** Ответ: переводы строго 1:1 по порядку с blocks. */
export interface TranslateTextResponse {
  translations: string[];
}
