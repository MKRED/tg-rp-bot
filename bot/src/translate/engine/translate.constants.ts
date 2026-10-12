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

/**
 * Одновременных запросов к переводчику на один батч абзацев. Google и Яндекс — по одному: неофициальные
 * эндпоинты режут по IP сервера (429), залп из нескольких запросов сразу упирался в лимит. ИИ — 4, чтобы
 * не упираться в лимиты личного ключа DeepSeek пользователя.
 */
export const TRANSLATE_BLOCK_CONCURRENCY = { google: 1, yandex: 1, ai: 4 } as const;
