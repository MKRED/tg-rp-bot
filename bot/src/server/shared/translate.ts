import { chatCompletion } from "../../llm/client.js";
import logger from "../../logger.js";
import { retry } from "../../utils/index.js";
import { DEFAULT_TRANSLATION_TEMPLATE, LANG_ENGLISH_NAMES } from "./translate.constants.js";

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

export function englishLangName(code: string): string {
  return LANG_ENGLISH_NAMES[code] ?? code;
}

/**
 * Переводит текст запросом к LLM (режим «ИИ» в шторе перевода). Системный промпт берётся из
 * пресета (плейсхолдер {{target_lang}} → полное англ. название языка), исходный текст уходит
 * ролью user, ответ ждём от assistant. Нестриминговый вызов chatCompletion (без onChunk).
 * Сэмплинг не передаём — параметры пресета настроены под RP и навредили бы переводу (см. вызов).
 * Рассуждение («мышление») запрашиваем всегда, вне зависимости от тумблера пресета — перевод
 * выигрывает от разбора смысла/идиом (для DeepSeek — thinking-режим, на OpenRouter reasoningBody
 * пустой, тело не меняется), эффорт берём из пресета (см. compactStory — тот же паттерн).
 */
export async function aiTranslate(
  systemPromptTemplate: string,
  text: string,
  targetLangName: string,
  userId: number,
  reasoningEffort?: string | null,
): Promise<string> {
  const t0 = Date.now();
  const template = systemPromptTemplate.trim() || DEFAULT_TRANSLATION_TEMPLATE;
  const system = template.replaceAll("{{target_lang}}", targetLangName);

  const result = await chatCompletion({
    messages: [
      { role: "system", content: system },
      { role: "user", content: text },
    ],
    // Тегируем для отладочного перехвата (фильтр «только мои запросы» + ярлык типа вызова).
    userId,
    debugLabel: "translate",
    requestReasoning: true,
    reasoningEffort: reasoningEffort ?? undefined,
  });

  logger.info(
    {
      durationMs: Date.now() - t0,
      targetLang: targetLangName,
      inputChars: text.length,
      outputChars: result.content.length,
      ...result.usage,
    },
    "aiTranslate done",
  );
  return result.content.trim();
}
