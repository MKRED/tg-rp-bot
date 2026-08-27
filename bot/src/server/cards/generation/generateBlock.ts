import {
  clearCardCategoryAskUserAnswers,
  getCard,
  setCardCategoryContent,
  setCardCategoryPendingQuestions,
} from "../../../db/cards/index.js";
import { getPreset } from "../../../db/presets/index.js";
import { getDecryptedTavilyKey, getTavilyMaxSearchRounds } from "../../../db/userTavilySettings.js";
import logger from "../../../logger.js";
import { presetToCompletionOptions } from "../../prompt/promptBuilder/index.js";
import { tryLockCard, unlockCard } from "../cardLock.js";
import { ASK_USER_MAX_ANSWERED_QUESTIONS, type AskUserQuestion } from "./askUserTool.js";
import { assembleCardBlockPrompt } from "./promptAssembly.js";
import { runCardGenerationToolLoop } from "./toolLoop.js";

export type GenerateCardBlockResult =
  // Отдаём только categoryId+content (не всю карточку): клиент мержит точечно по id, не трогая
  // категории, которые пользователь мог параллельно редактировать локально (ещё не сохранены) —
  // полная карточка с сервера затёрла бы такие несохранённые правки.
  | { ok: true; status: "done"; categoryId: string; content: string }
  // Модель попросила уточнение (ask_user) — questions уже сохранены на категории (см.
  // setCardCategoryPendingQuestions), клиент отвечает через answerCardBlockQuestions
  // (answerQuestions.ts) без ограничения по времени; cardLock уже снят.
  | { ok: true; status: "questions"; categoryId: string; questions: AskUserQuestion[] }
  | { ok: false; status: 400 | 404 | 409; reason: string };

/**
 * Генерирует блок карточки (см. assembleCardBlockPrompt) и сохраняет результат в его content.
 * Без categoryId — следующий незаполненный enabled-блок (обычный сценарий «Сгенерировать»);
 * с categoryId — явно указанный блок, перегенерация уже заполненного «как если бы шли по очереди»
 * (кнопка «Перегенерировать» на клиенте, доступна только для блоков выше первого пустого; тем же
 * путём резюмируется генерация после ответа на ask_user — см. answerQuestions.ts).
 * Сэмплинг/reasoning — из пресета карточки (presetToCompletionOptions, как у RP-чата/narrator):
 * пользователь явно предпочёл reasoning форсированному JSON-режиму ответа, поэтому здесь нет ни
 * response_format, ни отключения thinking — обычная генерация текста.
 *
 * Держит cardLock на всё время вызова — не только против повторного клика «Сгенерировать»/
 * «Перегенерировать» на той же карточке, но и против параллельного PUT /:id (сохранение формы):
 * оба пути заканчиваются read-modify-write полной строки (см. cardLock.ts). При паузе на ask_user
 * (status: "questions") лок СНИМАЕТСЯ сразу — ждать ответа пользователя нечем: вопросы уже
 * персистентны на категории, а не в состоянии этого вызова.
 *
 * resetAskUserAnswers — true только у явного «Перегенерировать» (см. cards.controller.ts,
 * POST /:id/generate): сбрасывает askUserAnswers ЦЕЛЕВОЙ категории перед генерацией, чтобы ответы,
 * собранные для заменяемого варианта блока, не реплеились в промпт (см. promptAssembly.ts) и не
 * занимали ASK_USER_MAX_ANSWERED_QUESTIONS вечно при каждой следующей перегенерации того же блока.
 * false (по умолчанию) — резюме паузы ask_user внутри ОДНОЙ попытки (answerQuestions.ts), где
 * ответы, наоборот, должны накапливаться.
 */
export async function generateCardBlock(
  userId: number,
  cardId: number,
  categoryId?: string,
  resetAskUserAnswers = false,
): Promise<GenerateCardBlockResult> {
  if (!tryLockCard(cardId)) return { ok: false, status: 409, reason: "busy" };
  const t0 = Date.now();

  const fail = (status: 400 | 404 | 409, reason: string): GenerateCardBlockResult => {
    unlockCard(cardId);
    return { ok: false, status, reason };
  };

  try {
    let card = await getCard(userId, cardId);
    if (!card) return fail(404, "not_found");

    if (resetAskUserAnswers && categoryId && card.categories.some((c) => c.id === categoryId && c.askUserAnswers?.length)) {
      const cleared = await clearCardCategoryAskUserAnswers(userId, cardId, categoryId);
      if (!cleared) return fail(404, "not_found");
      card = cleared;
    }

    if (card.presetId == null) return fail(400, "preset_required");
    const preset = await getPreset(userId, card.presetId);
    if (!preset) return fail(400, "preset_required");

    const assembled = assembleCardBlockPrompt(card.systemPrompt, card.prompt, card.categories, categoryId);
    if (!assembled) {
      // categoryId пришёл явно (кнопка «Перегенерировать») — раз assembleCardBlockPrompt не нашёл
      // валидную цель, значит локальное состояние клиента разошлось с сохранённым (категория
      // удалена/выключена/что-то перед ней ещё не заполнено в параллельной сессии) — не тот же
      // случай, что «генерировать больше нечего» у обычной кнопки «Сгенерировать».
      return categoryId ? fail(400, "target_not_found") : fail(409, "nothing_to_generate");
    }

    const completionOptions = {
      userId,
      debugLabel: "cards" as const,
      ...presetToCompletionOptions(preset),
    };

    // Ключ мог быть удалён в настройках уже после того, как тумблер остался включённым на
    // карточке — генерируем без поиска, а не роняем всю генерацию блока из-за этого (но не молчим).
    const tavilyApiKey = card.useWebSearch ? await getDecryptedTavilyKey(userId) : null;
    if (card.useWebSearch && !tavilyApiKey) {
      logger.warn({ userId, cardId }, "Card useWebSearch включён, но ключ Tavily не задан — генерируем без поиска");
    }
    const maxSearchRounds = await getTavilyMaxSearchRounds(userId);

    // Гейт на накопленный ask_user-бюджет ЭТОГО блока (через все прошлые HTTP-раунды ответа, не
    // только текущий вызов LLM — см. ASK_USER_MAX_ANSWERED_QUESTIONS в toolLoop.ts/askUserTool.ts).
    const targetCategory = card.categories.find((c) => c.id === assembled.targetCategoryId);
    const askUserAnswersSoFar = targetCategory?.askUserAnswers?.length ?? 0;
    const askUserEnabled = card.useAskUser && askUserAnswersSoFar < ASK_USER_MAX_ANSWERED_QUESTIONS;

    const outcome = await runCardGenerationToolLoop({
      baseOptions: completionOptions,
      history: assembled.messages,
      tavilyApiKey,
      maxSearchRounds,
      askUserEnabled,
    });

    if (!outcome.done) {
      const updated = await setCardCategoryPendingQuestions(userId, cardId, assembled.targetCategoryId, outcome.questions);
      if (!updated) return fail(404, "not_found");
      unlockCard(cardId);
      return { ok: true, status: "questions", categoryId: assembled.targetCategoryId, questions: outcome.questions };
    }

    const content = outcome.content.trim();
    const updated = await setCardCategoryContent(userId, cardId, assembled.targetCategoryId, content);
    if (!updated) return fail(404, "not_found");

    unlockCard(cardId);
    logger.info(
      { durationMs: Date.now() - t0, userId, cardId, categoryId: assembled.targetCategoryId },
      "Card block generated",
    );
    return { ok: true, status: "done", categoryId: assembled.targetCategoryId, content };
  } catch (err) {
    unlockCard(cardId);
    throw err;
  }
}
