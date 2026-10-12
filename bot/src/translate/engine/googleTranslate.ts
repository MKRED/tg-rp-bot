import logger from "../../logger.js";
import { googleRetryDelayMs, GoogleTranslateHttpError, isRetryableGoogleError } from "./googleRetry.js";

/** Попыток на один запрос, включая первую. */
const GOOGLE_ATTEMPTS = 3;

/**
 * Переводит текст через неофициальный Google Translate endpoint (без API-ключа).
 * Тот же endpoint использует SillyTavern: client=gtx, sl=auto, dt=t.
 * Ответ: [[["переведённый текст","исходный","","",""],...],null,"auto"]
 *
 * Endpoint режет по IP сервера (429). Повторяем только то, что может пройти позже (429, 5xx, сеть), с
 * нарастающей паузой или по Retry-After — частые повторы лишь продлевали бы блокировку.
 */
export async function googleTranslate(text: string, targetLang: string): Promise<string> {
  const t0 = Date.now();
  logger.debug({ targetLang, chars: text.length }, "googleTranslate start");

  for (let attempt = 1; ; attempt++) {
    try {
      const result = await requestOnce(text, targetLang);
      logger.info(
        { durationMs: Date.now() - t0, targetLang, inputChars: text.length, outputChars: result.length, attempt },
        "googleTranslate done",
      );
      return result;
    } catch (err) {
      if (attempt >= GOOGLE_ATTEMPTS || !isRetryableGoogleError(err)) {
        logger.error({ err, targetLang, chars: text.length, attempt, durationMs: Date.now() - t0 }, "googleTranslate failed");
        throw err;
      }
      const retryAfter = err instanceof GoogleTranslateHttpError ? err.retryAfter : null;
      const delayMs = googleRetryDelayMs(attempt, retryAfter);
      logger.warn({ err, targetLang, attempt, delayMs }, "googleTranslate retrying");
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function requestOnce(text: string, targetLang: string): Promise<string> {
  const url =
    `https://translate.googleapis.com/translate_a/single` +
    `?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(url);
  if (!response.ok) throw new GoogleTranslateHttpError(response.status, response.headers.get("retry-after"));
  const data = (await response.json()) as Array<unknown>;
  // data[0] — массив фрагментов [[translated, original, ...], ...]
  const fragments = data[0] as Array<[string]>;
  return fragments.map(([t]) => t).join("");
}
