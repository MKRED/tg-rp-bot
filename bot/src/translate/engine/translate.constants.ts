/**
 * Полные английские названия языков по коду (значения LANG_OPTIONS из webapp). Нужны для
 * подстановки в плейсхолдер {{target_lang}} ИИ-промпта — он всегда получает английское название,
 * а не код. Неизвестный код → сам код (фолбэк, см. englishLangName).
 */
export const LANG_ENGLISH_NAMES: Record<string, string> = {
  ru: "Russian",
  en: "English",
  de: "German",
  ja: "Japanese",
  zh: "Chinese",
  fr: "French",
  es: "Spanish",
};

/** Дефолтный системный промпт ИИ-перевода, когда в пресете он не задан. */
export const DEFAULT_TRANSLATION_TEMPLATE =
  "You are a translation engine. Translate the user's message into {{target_lang}}. " +
  "Output only the translation, preserving formatting and meaning; no notes or explanations.";

/** Дефолт narrator_templates.translation_reasoning_effort (колонка обязательна) — общий с webapp. */
export { DEFAULT_TRANSLATION_REASONING_EFFORT } from "@tg-rp-bot/shared";

// Константы безэнтитного эндпоинта POST /api/translate/text (режим перевода в PromptEditorOverlay);
// лимит абзацев в запросе — часть контракта (@tg-rp-bot/shared, translate.ts), настройки по
// умолчанию (уровни reasoning и т.п.) — там же (settings.ts).

/**
 * Порог длины (символы) для чанкинга ОДНОГО блока на сервере (translateChunking.ts) — консервативный
 * запас под GET-query-string неофициального Google-эндпоинта (googleTranslate кладёт текст в query).
 */
export const MAX_CHARS_PER_CALL = 4000;

/** Максимум одновременных запросов к переводчику на один батч — не бомбить неофициальный Google-эндпоинт
 * (склонен к рейт-лимитам) и не упираться в лимиты личного ключа DeepSeek пользователя. */
export const TRANSLATE_BLOCK_CONCURRENCY = 4;
