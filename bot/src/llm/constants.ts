/** Эндпоинт chat completions (общий для OpenAI-совместимых провайдеров). */
export const CHAT_COMPLETIONS_PATH = "/chat/completions";

/** Эндпоинт Responses API (DeepSeek) — картинки в результатах инструментов, см. responses/client.ts. */
export const RESPONSES_PATH = "/v1/responses";

/** Модель по умолчанию — общая с webapp (форма пресета показывает её для model: null). */
export { DEFAULT_DEEPSEEK_MODEL } from "@tg-rp-bot/shared";
