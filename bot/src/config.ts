// Загружаем .env встроенным механизмом Node (без dotenv-зависимости).
// В проде переменные часто заданы извне и файла нет — поэтому ошибку отсутствия глушим.
try {
  process.loadEnvFile();
} catch {
  // .env не найден — значит переменные пришли из окружения, это нормально
}

/** Бросает понятную ошибку, если обязательная переменная окружения не задана. */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const config = {
  /** Токен Telegram-бота (BotFather). */
  botToken: requireEnv("BOT_TOKEN"),

  /** Строка подключения к Postgres для drizzle. */
  databaseUrl: requireEnv("DATABASE_URL"),

  /**
   * HTTP-прокси ТОЛЬКО для запросов к Telegram Bot API (например http://127.0.0.1:8080).
   * Если не задан — идём к Telegram напрямую. На OpenRouter/прочее НЕ влияет.
   */
  telegramProxyUrl: process.env.TELEGRAM_PROXY_URL,

  /**
   * Активный LLM-провайдер: "openrouter" | "deepseek". По умолчанию openrouter
   * (бэк-совместимость). Чтобы слать запросы в DeepSeek — задать LLM_PROVIDER=deepseek.
   */
  llmProvider: process.env.LLM_PROVIDER ?? "openrouter",

  /** Ключ OpenRouter. Опционален: валидируется в момент вызова LLM, не на старте. */
  openRouterApiKey: process.env.OPENROUTER_API_KEY,

  /** Модель OpenRouter по умолчанию. */
  openRouterModel: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",

  /** Ключ DeepSeek. Опционален: валидируется в момент вызова LLM, не на старте. */
  deepSeekApiKey: process.env.DEEPSEEK_API_KEY,

  /** Модель DeepSeek по умолчанию. */
  deepSeekModel: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",

  /** Порт HTTP-сервера для Mini App API. */
  port: Number(process.env.PORT ?? 3000),

  /** Публичный URL развёрнутого Mini App (для кнопки запуска из /start). */
  webAppUrl: process.env.WEBAPP_URL,

  /** Уровень логирования pino. */
  logLevel: process.env.LOG_LEVEL ?? "info",

  /** true, если бот запущен в production (влияет на формат логов). */
  isProduction: process.env.NODE_ENV === "production",
} as const;
