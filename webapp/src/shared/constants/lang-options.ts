import type { LangOption } from "../components/LangPicker";

/**
 * Целевые языки перевода — единый список для шторы перевода черновика (LangPicker) и настроек
 * перевода RP-чата/истории. Раньше дублировался в features/rp-chat и features/narrator; сведён
 * сюда. Доменные SCOPE_OPTIONS/AUTO_SCOPE_OPTIONS остаются в каждой фиче — у них разные лейблы
 * (ответы ИИ vs биты, мои сообщения vs директивы).
 */
export const LANG_OPTIONS: LangOption[] = [
  { value: "ru", label: "Русский" },
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "ja", label: "日本語" },
  { value: "zh", label: "中文" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
];
