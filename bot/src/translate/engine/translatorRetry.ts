import logger from "../../logger.js";

/** Неофициальные переводчики без ключа (Google, Яндекс) — по имени в сообщении видно, кто отказал. */
export type MachineTranslator = "Google" | "Yandex";

/** Отказ переводчика: HTTP-код ответа (или код из тела у Яндекса). */
export class TranslatorHttpError extends Error {
  constructor(
    readonly provider: MachineTranslator,
    readonly status: number,
    /** Заголовок Retry-After как пришёл (секунды или HTTP-дата), null — не было. */
    readonly retryAfter: string | null = null,
  ) {
    super(`${provider} Translate HTTP ${status}`);
    this.name = "TranslatorHttpError";
  }
}

/** Вместо перевода пришла капча (HTML) — антибот; со временем обычно проходит. */
export class TranslatorCaptchaError extends Error {
  constructor(readonly provider: MachineTranslator) {
    super(`${provider} Translate captcha`);
    this.name = "TranslatorCaptchaError";
  }
}

/** Попыток на один запрос, включая первую. */
const ATTEMPTS = 3;
/** Первая пауза перед повтором; дальше удваивается (2 с → 4 с). */
const BASE_DELAY_MS = 2000;
/** Потолок паузы: дольше держать запрос пользователя нет смысла — пусть лучше упадёт с ошибкой. */
const MAX_DELAY_MS = 10_000;

/**
 * Стоит ли повторять: 429 (лимит) и 5xx — временные; прочие 4xx — запрос сам по себе плохой (или
 * дневной лимит Яндекса — 403, до завтра не пройдёт). Капча и не HTTP-ошибка (fetch failed, обрыв,
 * битый ответ) — тоже повторяем.
 */
export function isRetryableTranslatorError(err: unknown): boolean {
  if (!(err instanceof TranslatorHttpError)) return true;
  return err.status === 429 || err.status >= 500;
}

/**
 * Пауза перед повтором номер attempt (1 — после первой неудачи): Retry-After, если переводчик его
 * прислал, иначе удвоение от BASE_DELAY_MS; не больше MAX_DELAY_MS.
 */
export function translatorRetryDelayMs(attempt: number, retryAfter: string | null, now = Date.now()): number {
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

/**
 * Запрос к неофициальному переводчику с повтором. Эндпоинты режут по IP сервера — повторяем только
 * то, что может пройти позже, с нарастающей паузой: частые повторы лишь продлевали бы блокировку.
 * Логи — по CLAUDE.md: старт, готово (длительность, длины, попытка), отказ.
 */
export async function withTranslatorRetry(
  provider: MachineTranslator,
  meta: { targetLang: string; chars: number },
  request: () => Promise<string>,
): Promise<string> {
  const label = `${provider.toLowerCase()}Translate`;
  const t0 = Date.now();
  logger.debug(meta, `${label} start`);

  for (let attempt = 1; ; attempt++) {
    try {
      const result = await request();
      logger.info({ durationMs: Date.now() - t0, ...meta, outputChars: result.length, attempt }, `${label} done`);
      return result;
    } catch (err) {
      if (attempt >= ATTEMPTS || !isRetryableTranslatorError(err)) {
        logger.error({ err, ...meta, attempt, durationMs: Date.now() - t0 }, `${label} failed`);
        throw err;
      }
      const retryAfter = err instanceof TranslatorHttpError ? err.retryAfter : null;
      const delayMs = translatorRetryDelayMs(attempt, retryAfter);
      logger.warn({ err, ...meta, attempt, delayMs }, `${label} retrying`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
