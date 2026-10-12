import { TranslatorCaptchaError, TranslatorHttpError } from "./translatorRetry.js";

/**
 * Разбор ответа неофициального Яндекс-API. Успех — JSON `{"code":200,"lang":"ru-en","text":["…"]}`.
 * Ошибка приходит кодом в теле при HTTP 200 (403 — дневной лимит, 413 — слишком длинный текст), а
 * антибот отвечает HTML-страницей капчи (тоже 200 после редиректа на /showcaptcha) — поэтому смотрим
 * и HTTP-статус, и тип, и поле code.
 */
export function parseYandexResponse(
  status: number,
  contentType: string | null,
  body: string,
  retryAfter: string | null = null,
): string {
  const isJson = contentType?.includes("application/json") ?? false;
  if (status < 200 || status >= 300) {
    if (!isJson) throw new TranslatorHttpError("Yandex", status, retryAfter);
  } else if (!isJson) {
    throw new TranslatorCaptchaError("Yandex");
  }

  let data: { code?: unknown; text?: unknown };
  try {
    data = JSON.parse(body) as { code?: unknown; text?: unknown };
  } catch (err) {
    // Битый JSON при «json»-типе — как сетевой сбой: повторяемая ошибка с понятным текстом.
    throw new Error("Yandex Translate: invalid JSON response", { cause: err });
  }
  const code = typeof data.code === "number" ? data.code : status;
  if (code !== 200 || !Array.isArray(data.text)) throw new TranslatorHttpError("Yandex", code === 200 ? 502 : code, retryAfter);
  return data.text.filter((t): t is string => typeof t === "string").join("");
}
