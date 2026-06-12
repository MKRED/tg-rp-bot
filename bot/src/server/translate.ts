import logger from "../logger.js";
import { retry } from "../utils/index.js";

/**
 * Переводит текст через неофициальный Google Translate endpoint (без API-ключа).
 * Тот же endpoint использует SillyTavern: client=gtx, sl=auto, dt=t.
 * Ответ: [[["переведённый текст","исходный","","",""],...],null,"auto"]
 *
 * Оборачиваем в retry — неофициальный endpoint периодически rate-limits/блокирует.
 */
export async function googleTranslate(text: string, targetLang: string): Promise<string> {
  const t0 = Date.now();
  logger.debug({ targetLang, chars: text.length }, "googleTranslate start");

  const result = await retry(
    async () => {
      const url =
        `https://translate.googleapis.com/translate_a/single` +
        `?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Google Translate HTTP ${response.status}`);
      }
      const data = (await response.json()) as Array<unknown>;
      // data[0] — массив фрагментов [[translated, original, ...], ...]
      const fragments = data[0] as Array<[string]>;
      return fragments.map(([t]) => t).join("");
    },
    3,
    1000,
    "googleTranslate",
  );

  logger.info(
    { durationMs: Date.now() - t0, targetLang, inputChars: text.length, outputChars: result.length },
    "googleTranslate done",
  );
  return result;
}
