/** Базовый URL OpenRouter (OpenAI-совместимый API). */
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/** Эндпоинт chat completions. */
export const CHAT_COMPLETIONS_PATH = "/chat/completions";

/**
 * Заголовки, которые OpenRouter рекомендует слать для атрибуции приложения
 * (видны в их рейтингах). Значения некритичны — это просто метка нашего бота.
 */
export const OPENROUTER_APP_HEADERS = {
  "HTTP-Referer": "https://github.com/tg-rp-bot",
  "X-Title": "tg-rp-bot",
} as const;
