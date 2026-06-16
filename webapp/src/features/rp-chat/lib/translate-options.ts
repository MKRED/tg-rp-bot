import type { ChatSettings } from "../types/chat";

/** Опции выпадающих списков настроек перевода чата (RpChatSettingsPage). */

export const LANG_OPTIONS: { value: string; label: string }[] = [
  { value: "ru", label: "Русский" },
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "ja", label: "日本語" },
  { value: "zh", label: "中文" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
];

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
