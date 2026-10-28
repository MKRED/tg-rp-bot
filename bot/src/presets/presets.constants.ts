import type { SamplingKey } from "@tg-rp-bot/shared";

/** Допустимый диапазон параметра сэмплинга; max нет — верхней границы нет. */
export type SamplingRange = { min: number; max?: number; integer?: boolean };

/** Диапазоны параметров сэмплинга по документации DeepSeek (create-chat-completion). */
export const SAMPLING_RANGES: Record<SamplingKey, SamplingRange> = {
  temperature: { min: 0, max: 2 },
  topP: { min: 0, max: 1 },
};
