import { PROMPT_TRANSLATE_ENGINES, type PromptTranslateEngine } from "@tg-rp-bot/shared";

/** Варианты метода перевода для переключателей (настройки, шторка перевода, редактор промптов). */
export const TRANSLATE_ENGINE_OPTIONS: { value: PromptTranslateEngine; label: string }[] = [
  { value: "google", label: "Google" },
  { value: "yandex", label: "Яндекс" },
  { value: "ai", label: "ИИ" },
];

/** Значение из localStorage или переключателя → метод; неизвестное — google. */
export function parseTranslateEngine(value: unknown): PromptTranslateEngine {
  return (PROMPT_TRANSLATE_ENGINES as readonly unknown[]).includes(value) ? (value as PromptTranslateEngine) : "google";
}
