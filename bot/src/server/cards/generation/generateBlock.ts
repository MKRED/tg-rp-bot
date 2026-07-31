import { getCard, setCardCategoryContent } from "../../../db/cards/index.js";
import { getPreset } from "../../../db/presets/index.js";
import { chatCompletion } from "../../../llm/client.js";
import logger from "../../../logger.js";
import { presetToCompletionOptions } from "../../prompt/promptBuilder/index.js";
import { tryLockCard, unlockCard } from "../cardLock.js";
import { assembleCardBlockPrompt } from "./promptAssembly.js";

export type GenerateCardBlockResult =
  // Отдаём только categoryId+content (не всю карточку): клиент мержит точечно по id, не трогая
  // категории, которые пользователь мог параллельно редактировать локально (ещё не сохранены) —
  // полная карточка с сервера затёрла бы такие несохранённые правки.
  | { ok: true; categoryId: string; content: string }
  | { ok: false; status: 400 | 404 | 409; reason: string };

/**
 * Генерирует блок карточки (см. assembleCardBlockPrompt) и сохраняет результат в его content.
 * Без categoryId — следующий незаполненный enabled-блок (обычный сценарий «Сгенерировать»);
 * с categoryId — явно указанный блок, перегенерация уже заполненного «как если бы шли по очереди»
 * (кнопка «Перегенерировать» на клиенте, доступна только для блоков выше первого пустого).
 * Сэмплинг/reasoning — из пресета карточки (presetToCompletionOptions, как у RP-чата/narrator):
 * пользователь явно предпочёл reasoning форсированному JSON-режиму ответа, поэтому здесь нет ни
 * response_format, ни отключения thinking — обычная генерация текста.
 *
 * Держит cardLock на всё время вызова (включая сам LLM-запрос) — не только против повторного клика
 * «Сгенерировать»/«Перегенерировать» на той же карточке, но и против параллельного PUT /:id
 * (сохранение формы): оба пути заканчиваются read-modify-write полной строки (см. cardLock.ts).
 */
export async function generateCardBlock(
  userId: number,
  cardId: number,
  categoryId?: string,
): Promise<GenerateCardBlockResult> {
  if (!tryLockCard(cardId)) return { ok: false, status: 409, reason: "busy" };
  const t0 = Date.now();
  try {
    const card = await getCard(userId, cardId);
    if (!card) return { ok: false, status: 404, reason: "not_found" };
    if (card.presetId == null) return { ok: false, status: 400, reason: "preset_required" };

    const preset = await getPreset(userId, card.presetId);
    if (!preset) return { ok: false, status: 400, reason: "preset_required" };

    const assembled = assembleCardBlockPrompt(card.systemPrompt, card.prompt, card.categories, categoryId);
    if (!assembled) {
      // categoryId пришёл явно (кнопка «Перегенерировать») — раз assembleCardBlockPrompt не нашёл
      // валидную цель, значит локальное состояние клиента разошлось с сохранённым (категория
      // удалена/выключена/что-то перед ней ещё не заполнено в параллельной сессии) — не тот же
      // случай, что «генерировать больше нечего» у обычной кнопки «Сгенерировать».
      return categoryId
        ? { ok: false, status: 400, reason: "target_not_found" }
        : { ok: false, status: 409, reason: "nothing_to_generate" };
    }

    const result = await chatCompletion({
      userId,
      messages: assembled.messages,
      debugLabel: "cards",
      ...presetToCompletionOptions(preset),
    });

    const content = result.content.trim();
    const updated = await setCardCategoryContent(userId, cardId, assembled.targetCategoryId, content);
    if (!updated) return { ok: false, status: 404, reason: "not_found" };

    logger.info(
      { durationMs: Date.now() - t0, userId, cardId, categoryId: assembled.targetCategoryId },
      "Card block generated",
    );
    return { ok: true, categoryId: assembled.targetCategoryId, content };
  } finally {
    unlockCard(cardId);
  }
}
