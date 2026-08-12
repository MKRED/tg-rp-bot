/** Ручное зеркало серверных типов (bot/src/server/settings/translate.controller.ts). */

/**
 * Уровень рассуждения ИИ-перевода в PromptEditorOverlay. Зеркалит серверный
 * PROMPT_TRANSLATE_REASONING_LEVELS (bot/src/server/shared/translate.constants.ts) — держать в
 * синхроне. Аналог TranslationReasoningLevel у narrator-templates, но не переиспользуем импортом
 * между фичами — по конвенции проекта фичи самодостаточны.
 */
export type PromptTranslateReasoningEffort = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

export const PROMPT_TRANSLATE_REASONING_LEVELS: PromptTranslateReasoningEffort[] = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
];

export const PROMPT_TRANSLATE_REASONING_LABELS: Record<PromptTranslateReasoningEffort, string> = {
  off: "Отключено",
  minimal: "Минимальное",
  low: "Низкое",
  medium: "Среднее",
  high: "Высокое",
  xhigh: "Максимальное",
};

export interface TranslateSettings {
  engine: "google" | "ai";
  targetLang: string;
  /** null — свой промпт не задан, сервер использует дефолтный шаблон. */
  promptTemplate: string | null;
  reasoningEffort: PromptTranslateReasoningEffort;
}

export interface TranslateSettingsPatch {
  engine?: "google" | "ai";
  targetLang?: string;
  /** undefined — не трогать; null — сбросить на дефолтный промпт; string — задать свой. */
  promptTemplate?: string | null;
  reasoningEffort?: PromptTranslateReasoningEffort;
}
