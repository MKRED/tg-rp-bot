import { REASONING_EFFORTS } from "../presets/presets.constants.js";

export const MAX_TEMPLATES_PER_USER = 50;

// Допустимые значения обязательного поля translationReasoningEffort: "off" — рассуждение выключено
// для перевода, остальное — форсированный уровень effort.
export const TRANSLATION_REASONING_LEVELS = ["off", ...REASONING_EFFORTS] as const;
