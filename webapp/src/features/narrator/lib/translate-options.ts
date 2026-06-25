import type { StorySettings } from "../types/story";

/**
 * Опции выпадающих списков настроек перевода истории (StorySettingsPage). Лейблы адаптированы
 * под narrator-домен: assistant — биты ИИ, user — режиссёрские директивы (в RP это «ответы ИИ» /
 * «мои сообщения»). LANG_OPTIONS дублируют rp-chat/lib/translate-options.ts намеренно (чтобы narrator
 * не импортировал из rp-chat) — при добавлении языка синхронизировать оба файла.
 */

export const LANG_OPTIONS: { value: string; label: string }[] = [
  { value: "ru", label: "Русский" },
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "ja", label: "日本語" },
  { value: "zh", label: "中文" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
];

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
