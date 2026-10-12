/** Ответ Google Translate не 2xx. Сообщение прежнее — его ищут в логах и тестах. */
export class GoogleTranslateHttpError extends Error {
  constructor(
    readonly status: number,
    /** Заголовок Retry-After как пришёл (секунды или HTTP-дата), null — не было. */
    readonly retryAfter: string | null = null,
  ) {
    super(`Google Translate HTTP ${status}`);
    this.name = "GoogleTranslateHttpError";
  }
}

/** Первая пауза перед повтором; дальше удваивается (2 с → 4 с). */
const BASE_DELAY_MS = 2000;
/** Потолок паузы: дольше держать запрос пользователя нет смысла — пусть лучше упадёт с ошибкой. */
const MAX_DELAY_MS = 10_000;

/**
 * Стоит ли повторять: 429 (лимит) и 5xx — временные; прочие 4xx — запрос сам по себе плохой.
 * Не HTTP-ошибка — сетевой сбой (fetch failed, обрыв) или битый ответ, тоже повторяем.
 */
export function isRetryableGoogleError(err: unknown): boolean {
  if (!(err instanceof GoogleTranslateHttpError)) return true;
  return err.status === 429 || err.status >= 500;
}

/**
 * Пауза перед повтором номер attempt (1 — после первой неудачи): Retry-After, если Google его прислал,
 * иначе удвоение от BASE_DELAY_MS; не больше MAX_DELAY_MS.
 */
export function googleRetryDelayMs(attempt: number, retryAfter: string | null, now = Date.now()): number {
  const fromHeader = parseRetryAfterMs(retryAfter, now);
  const delay = fromHeader ?? BASE_DELAY_MS * 2 ** (attempt - 1);
  return Math.min(delay, MAX_DELAY_MS);
}

/** Retry-After: целые секунды или HTTP-дата. Непонятное значение — null. */
function parseRetryAfterMs(value: string | null, now: number): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
  const date = Date.parse(trimmed);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
}
