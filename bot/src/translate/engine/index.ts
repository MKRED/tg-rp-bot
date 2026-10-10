/**
 * Движок перевода — чистые функции без Nest: ими пользуются TranslateService (POST /translate/text),
 * перевод в RP-чате (rp-chat/translation) и в историях (narrator/translation).
 */
export {
  DEFAULT_TRANSLATION_TEMPLATE,
  MAX_CHARS_PER_CALL,
  TRANSLATE_BLOCK_CONCURRENCY,
} from "./translate.constants.js";
export { chunkText, joinChunks, translateChunked } from "./translateChunking.js";
export { joinParagraphs, splitParagraphs, type TextParagraph } from "./translateParagraphs.js";
export { aiTranslate, englishLangName, googleTranslate, resolveTranslationReasoning } from "./translators.js";
