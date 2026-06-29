import type { StorySettings } from "../types/story";

/**
 * Опции выпадающих списков настроек перевода истории (StorySettingsPage). Лейблы адаптированы
 * под narrator-домен: assistant — биты ИИ, user — режиссёрские директивы (в RP это «ответы ИИ» /
 * «мои сообщения»).
 */

// LANG_OPTIONS — общий список языков, живёт в shared рядом с LangPicker (был дубль с rp-chat).
export { LANG_OPTIONS } from "../../../shared/constants/lang-options";

export const SCOPE_OPTIONS: { value: StorySettings["translateScope"]; label: string }[] = [
  { value: "all", label: "Все сообщения" },
  { value: "assistant", label: "Только биты ИИ" },
  { value: "user", label: "Только директивы" },
];

export const AUTO_SCOPE_OPTIONS: { value: StorySettings["autoTranslateScope"]; label: string }[] = [
  { value: "none", label: "Отключён" },
  { value: "all", label: "Все сообщения" },
  { value: "assistant", label: "Биты ИИ" },
  { value: "user", label: "Директивы" },
];
