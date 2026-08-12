import type { LangOption } from "../components/LangPicker";

/**
 * Целевые языки перевода — единый список для шторы перевода черновика (LangPicker) и настроек
 * перевода RP-чата/истории. Раньше дублировался в features/rp-chat и features/narrator; сведён
 * сюда. Доменные SCOPE_OPTIONS/AUTO_SCOPE_OPTIONS остаются в каждой фиче — у них разные лейблы
 * (ответы ИИ vs биты, мои сообщения vs директивы).
 */
export const LANG_OPTIONS: LangOption[] = [
  { value: "ru", label: "Русский", shortLabel: "Ru" },
  { value: "en", label: "English", shortLabel: "En" },
  { value: "de", label: "Deutsch", shortLabel: "De" },
  { value: "ja", label: "日本語", shortLabel: "日" },
  { value: "zh", label: "中文", shortLabel: "中" },
  { value: "fr", label: "Français", shortLabel: "Fr" },
  { value: "es", label: "Español", shortLabel: "Es" },
];
