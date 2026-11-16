import { hasQuoteTags, unwrapRpQuotes, wrapRpQuotes } from "./rpQuoteMarkup.js";
import { TranslatorHttpError, withTranslatorRetry } from "./translatorRetry.js";

/**
 * Переводит текст через неофициальный Google Translate endpoint (без API-ключа).
 * Тот же endpoint использует SillyTavern: client=gtx, sl=auto, dt=t.
 * Ответ: [[["переведённый текст","исходный","","",""],...],null,"auto"]
 * Язык источника Google определяет сам (sl=auto). Повторы и логи — withTranslatorRetry.
 * "Речь" и «мысли» уходят тегами (rpQuoteMarkup): иначе Google меняет кавычки на типографику языка.
 * Теги он и в текстовом режиме переносит на место перевода — HTML-режим (translate_a/t) не нужен, а он
 * схлопывает переносы строк и добавляет свои кавычки внутрь тегов.
 */
export async function googleTranslate(text: string, targetLang: string): Promise<string> {
  const protect = !hasQuoteTags(text);
  const source = protect ? wrapRpQuotes(text) : text;
  const translated = await withTranslatorRetry("Google", { targetLang, chars: text.length }, () =>
    requestOnce(source, targetLang),
  );
  return protect ? unwrapRpQuotes(translated) : translated;
}

async function requestOnce(text: string, targetLang: string): Promise<string> {
  const url =
    `https://translate.googleapis.com/translate_a/single` +
    `?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(url);
  if (!response.ok) throw new TranslatorHttpError("Google", response.status, response.headers.get("retry-after"));
  const data = (await response.json()) as Array<unknown>;
  // data[0] — массив фрагментов [[translated, original, ...], ...]
  const fragments = data[0] as Array<[string]>;
  return fragments.map(([t]) => t).join("");
}
