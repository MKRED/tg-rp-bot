import type { PromptTranslateReasoningEffort } from "@tg-rp-bot/shared";

/** Контракт /api/settings/translate и набор уровней reasoning — общие с сервером, в @tg-rp-bot/shared. */
export {
  PROMPT_TRANSLATE_REASONING_LEVELS,
  type PromptTranslateReasoningEffort,
  type TranslateSettings,
  type TranslateSettingsPatch,
} from "@tg-rp-bot/shared";

export const PROMPT_TRANSLATE_REASONING_LABELS = {
  off: "Отключено",
  minimal: "Минимальное",
  low: "Низкое",
  medium: "Среднее",
  high: "Высокое",
  xhigh: "Очень высокое",
  max: "Максимальное",
  ultra: "Ультра",
} satisfies Record<PromptTranslateReasoningEffort, string>;
