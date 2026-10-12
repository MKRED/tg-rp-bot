import { PROMPT_TRANSLATE_ENGINES, type PromptTranslateEngine } from "@tg-rp-bot/shared";

/**
 * mode запроса перевода → движок. Разбор снисходителен (исторически): неизвестное значение или регистр
 * («AI») — google, а не 400.
 */
export const toTranslateEngine = ({ value }: { value: unknown }): PromptTranslateEngine =>
  (PROMPT_TRANSLATE_ENGINES as readonly unknown[]).includes(value) ? (value as PromptTranslateEngine) : "google";
