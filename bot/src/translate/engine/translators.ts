import type { ChatCompleter } from "../../llm/types.js";
import logger from "../../logger.js";
import {
  DEFAULT_TRANSLATION_REASONING_EFFORT,
  DEFAULT_TRANSLATION_TEMPLATE,
  LANG_ENGLISH_NAMES,
} from "./translate.constants.js";

export function englishLangName(code: string): string {
  return LANG_ENGLISH_NAMES[code] ?? code;
}

/**
 * Резолвит рассуждение для ИИ-перевода из обязательного поля narrator-шаблона
 * (translationReasoningEffort): "off" — рассуждение отключено; иначе — конкретный уровень effort,
 * форсированный вне зависимости от пресета. Фолбэк на дефолт — защитный кейс (шаблон истории не
 * резолвился, см. resolveNarratorMarkers — тот же паттерн).
 */
export function resolveTranslationReasoning(
  effort: string | null | undefined,
): { requestReasoning: boolean; reasoningEffort?: string } {
  const level = effort || DEFAULT_TRANSLATION_REASONING_EFFORT;
  if (level === "off") return { requestReasoning: false };
  return { requestReasoning: true, reasoningEffort: level };
}

/**
 * Переводит текст запросом к LLM (режим «ИИ» в шторе перевода). Системный промпт берётся из
 * пресета (плейсхолдер {{target_lang}} → полное англ. название языка), исходный текст уходит
 * ролью user, ответ ждём от assistant. Нестриминговый вызов llm.complete (без onChunk); llm —
 * LlmService вызывающего сервиса (ключ DeepSeek пользователя).
 * Текст оборачивается в <text_to_translate> — явно размечает для модели, что переводить, а не
 * исполнять как инструкцию, если внутри самого текста встретится что-то похожее на промпт.
 * Сэмплинг не передаём — параметры пресета настроены под RP и навредили бы переводу (см. вызов).
 * requestReasoning/reasoningEffort — резолвятся вызывающим кодом (см. resolveTranslationReasoning
 * для narrator, где шаблон форсирует уровень или отключает рассуждение; RP шлёт requestReasoning:true
 * всегда, эффорт — из пресета, там своего поля перевода для рассуждения нет).
 */
export async function aiTranslate(
  llm: ChatCompleter,
  systemPromptTemplate: string,
  text: string,
  targetLangName: string,
  userId: string,
  requestReasoning: boolean,
  reasoningEffort?: string | null,
): Promise<string> {
  const t0 = Date.now();
  const template = systemPromptTemplate.trim() || DEFAULT_TRANSLATION_TEMPLATE;
  const system = template.replaceAll("{{target_lang}}", targetLangName);

  const result = await llm.complete({
    messages: [
      { role: "system", content: system },
      { role: "user", content: `<text_to_translate>\n${text}\n</text_to_translate>` },
    ],
    // Тегируем для отладочного перехвата (фильтр «только мои запросы» + ярлык типа вызова).
    userId,
    debugLabel: "translate",
    requestReasoning,
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
