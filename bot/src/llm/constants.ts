/** Эндпоинт chat completions (общий для OpenAI-совместимых провайдеров). */
export const CHAT_COMPLETIONS_PATH = "/chat/completions";

/**
 * Заголовки, которые OpenRouter рекомендует слать для атрибуции приложения
 * (видны в их рейтингах). Значения некритичны — это просто метка нашего бота.
 */
export const OPENROUTER_APP_HEADERS = {
  "HTTP-Referer": "https://github.com/tg-rp-bot",
  "X-Title": "tg-rp-bot",
} as const;
