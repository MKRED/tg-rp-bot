import type { SamplingKey } from "@tg-rp-bot/shared";

/** Допустимый диапазон параметра сэмплинга; max нет — верхней границы нет. */
export type SamplingRange = { min: number; max?: number; integer?: boolean };

/**
 * Диапазоны параметров сэмплинга (официальные значения OpenRouter). topK без верхней границы
 * («0 or above») — проверяем только неотрицательность и целочисленность.
 */
export const SAMPLING_RANGES: Record<SamplingKey, SamplingRange> = {
  temperature: { min: 0, max: 2 },
  topP: { min: 0, max: 1 },
  topK: { min: 0, integer: true },
  frequencyPenalty: { min: -2, max: 2 },
  presencePenalty: { min: -2, max: 2 },
  repetitionPenalty: { min: 0, max: 2 },
  minP: { min: 0, max: 1 },
  topA: { min: 0, max: 1 },
};
