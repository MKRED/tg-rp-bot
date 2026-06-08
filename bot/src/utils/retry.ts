import logger from "../logger.js";

/**
 * Повторяет асинхронную операцию при сбое. Используем для всех внешних вызовов,
 * которые могут временно падать (сеть, 5xx, таймауты).
 *
 * @param fn          операция
 * @param attempts    общее число попыток (включая первую)
 * @param delayMs     базовая задержка; растёт линейно (delayMs * номер попытки)
 * @param label       метка для логов
 * @param shouldRetry предикат: стоит ли ретраить данную ошибку (по умолчанию — всегда)
 */
export async function retry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  delayMs = 1500,
  label = "operation",
  shouldRetry: (err: unknown) => boolean = () => true,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt >= attempts || !shouldRetry(err)) break;
      logger.warn({ err, label, attempt, attempts }, "Retrying after failure");
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
  throw lastErr;
}
