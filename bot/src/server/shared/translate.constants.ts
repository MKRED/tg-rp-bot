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
