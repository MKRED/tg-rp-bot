/**
 * Движок перевода — чистые функции без Nest: ими пользуются TranslateService (POST /translate/text)
 * и пока ещё legacy-эндпоинты перевода в чатах/историях (server/chats, server/stories).
 */
export {
  DEFAULT_TRANSLATION_TEMPLATE,
  MAX_CHARS_PER_CALL,
  TRANSLATE_BLOCK_CONCURRENCY,
} from "./translate.constants.js";
export { chunkText, joinChunks, translateChunked } from "./translateChunking.js";
export { joinParagraphs, splitParagraphs, type TextParagraph } from "./translateParagraphs.js";
export { aiTranslate, englishLangName, googleTranslate, resolveTranslationReasoning } from "./translators.js";
