import { randomUUID } from "node:crypto";
import { withTranslatorRetry } from "./translatorRetry.js";
import { fromYandexHtml, toYandexHtml } from "./yandexMarkup.js";
import { parseYandexResponse } from "./yandexResponse.js";

/**
 * Переводит текст через неофициальный API мобильного приложения Яндекс.Переводчика (без ключа) — тот
 * же, что у SillyTavern: POST tr.json/translate?srv=android, ucid — случайный на каждый запрос.
 * lang — только целевой язык: источник Яндекс определяет сам, как Google (sl=auto). Явную пару не шлём —
 * язык, выбранный в редакторе, может не совпасть с реальным текстом абзаца, и тогда текст вернулся бы
 * непереведённым. format=html — ради сохранности *действий* (см. yandexMarkup).
 * Повторы и логи — withTranslatorRetry.
 */
export function yandexTranslate(text: string, targetLang: string): Promise<string> {
  return withTranslatorRetry("Yandex", { targetLang, chars: text.length }, () => requestOnce(text, targetLang));
}

async function requestOnce(text: string, targetLang: string): Promise<string> {
  const ucid = randomUUID().replaceAll("-", "");
  const response = await fetch(
    `https://translate.yandex.net/api/v1/tr.json/translate?ucid=${ucid}&srv=android&format=html`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ lang: targetLang, text: toYandexHtml(text) }),
    },
  );
  const translated = parseYandexResponse(
    response.status,
    response.headers.get("content-type"),
    await response.text(),
    response.headers.get("retry-after"),
  );
  return fromYandexHtml(translated);
}
