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

const isProduction = process.env.NODE_ENV === "production";

// Dev-обход авторизации: подставить реального прод-юзера при открытии Mini App
// из обычного браузера без Telegram-контекста (initData недоступна вне Telegram).
// В проде ВСЕГДА undefined, даже если DEV_USER_ID случайно попал в окружение —
// fail-fast ниже гарантирует, что бэкдор не включится молча.
const devUserIdRaw = process.env.DEV_USER_ID;
if (isProduction && devUserIdRaw) {
  throw new Error("DEV_USER_ID задан в production — небезопасно, убери переменную из окружения");
}
if (!isProduction && devUserIdRaw && !Number.isInteger(Number(devUserIdRaw))) {
  // Иначе Number("abc") даёт NaN, devUserId !== undefined остаётся true, и requireInitData
  // молча подставит сломанного юзера с id: NaN — падать лучше сразу на старте, с понятной причиной.
  throw new Error(`DEV_USER_ID должен быть числом, получено: "${devUserIdRaw}"`);
}

export const config = {
  /** Токен Telegram-бота (BotFather). */
  botToken: requireEnv("BOT_TOKEN"),

  /** Строка подключения к Postgres для drizzle. */
  databaseUrl: requireEnv("DATABASE_URL"),

  /**
   * HTTP-прокси ТОЛЬКО для запросов к Telegram Bot API (например http://127.0.0.1:8080).
   * Если не задан — идём к Telegram напрямую. На LLM-провайдера (DeepSeek) НЕ влияет.
   */
  telegramProxyUrl: process.env.TELEGRAM_PROXY_URL,

  /** Порт HTTP-сервера для Mini App API. */
  port: Number(process.env.PORT ?? 3000),

  /** Публичный URL развёрнутого Mini App (для кнопки запуска из /start). */
  webAppUrl: process.env.WEBAPP_URL,

  /** Уровень логирования pino. */
  logLevel: process.env.LOG_LEVEL ?? "info",

  /** true, если бот запущен в production (влияет на формат логов). */
  isProduction,

  /**
   * Telegram-id реального прод-юзера для dev-обхода initData при открытии Mini App
   * из браузера. undefined вне dev или если переменная не задана — тогда requireInitData
   * ведёт себя как раньше (401 без подписи).
   */
  devUserId: !isProduction && devUserIdRaw ? Number(devUserIdRaw) : undefined,

  /**
   * Запускать ли grammY long polling (bot.start()). В проде — всегда true (см. index.ts).
   * Локально — по умолчанию false: один и тот же BOT_TOKEN не может одновременно поллиться
   * из двух процессов (Telegram отдаёт 409 Conflict и произвольно чередует получателя апдейтов),
   * а прод-контейнер поллит непрерывно. Включить локально явно — BOT_POLLING=true (с отдельным
   * dev-ботом от @BotFather, чтобы не конкурировать с прод-токеном за апдейты).
   */
  botPolling: isProduction || process.env.BOT_POLLING === "true",
} as const;
