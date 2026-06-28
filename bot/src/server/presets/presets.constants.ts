import type { PromptComponentId } from "../../db/schema.js";
import type { SamplingKey } from "./presets.types.js";

// Мягкий лимит (дублируется в webapp для блокировки UI — здесь последняя линия защиты).
export const MAX_PRESETS_PER_USER = 50;

// Допустимые уровни рассуждения OpenRouter (по возрастанию бюджета).
export const REASONING_EFFORTS = ["minimal", "low", "medium", "high", "xhigh"] as const;

// Канонический набор компонентов запроса — promptOrder обязан содержать ровно их (по разу).
export const PROMPT_COMPONENT_IDS: PromptComponentId[] = [
  "system",
  "characterDescription",
  "characterScenario",
  "userDescription",
  "auxiliary",
  "history",
  "postHistory",
];

/**
 * Диапазоны параметров сэмплинга (официальные значения OpenRouter). topK без верхней границы
 * («0 or above») — проверяем только неотрицательность и целочисленность.
 */
export const SAMPLING_RANGES: Record<SamplingKey, { min: number; max?: number; integer?: boolean }> = {
  temperature: { min: 0, max: 2 },
  topP: { min: 0, max: 1 },
  topK: { min: 0, integer: true },
  frequencyPenalty: { min: -2, max: 2 },
  presencePenalty: { min: -2, max: 2 },
  repetitionPenalty: { min: 0, max: 2 },
  minP: { min: 0, max: 1 },
  topA: { min: 0, max: 1 },
};
