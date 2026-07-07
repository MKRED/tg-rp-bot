import type { ChatSettings } from "../types/chat";

/** Опции выпадающих списков настроек перевода чата (RpChatSettingsPage). */

// LANG_OPTIONS — общий список языков, живёт в shared рядом с LangPicker (был дубль с narrator).
export { LANG_OPTIONS } from "../../../shared/constants/lang-options";

export const SCOPE_OPTIONS: { value: ChatSettings["translateScope"]; label: string }[] = [
  { value: "all", label: "Все сообщения" },
  { value: "assistant", label: "Только ответы ИИ" },
  { value: "user", label: "Только мои сообщения" },
];

export const AUTO_SCOPE_OPTIONS: { value: ChatSettings["autoTranslateScope"]; label: string }[] = [
  { value: "none", label: "Отключён" },
  { value: "all", label: "Все сообщения" },
  { value: "assistant", label: "Ответы ИИ" },
  { value: "user", label: "Мои сообщения" },
];

export const METHOD_OPTIONS: { value: ChatSettings["translateMethod"]; label: string }[] = [
  { value: "google", label: "Google" },
  { value: "ai", label: "ИИ" },
];
