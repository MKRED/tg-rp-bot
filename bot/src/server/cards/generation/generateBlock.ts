import { getCard, setCardCategoryContent } from "../../../db/cards/index.js";
import { getPreset } from "../../../db/presets/index.js";
import { getDecryptedTavilyKey, getTavilyMaxSearchRounds } from "../../../db/userTavilySettings.js";
import logger from "../../../logger.js";
import { presetToCompletionOptions } from "../../prompt/promptBuilder/index.js";
import { touchCardLock, tryLockCard, unlockCard } from "../cardLock.js";
import type { AskUserQuestion } from "./askUserTool.js";
import { setPendingGeneration } from "./pendingGeneration.js";
import { assembleCardBlockPrompt } from "./promptAssembly.js";
import { runCardGenerationToolLoop } from "./toolLoop.js";

export type GenerateCardBlockResult =
  // Отдаём только categoryId+content (не всю карточку): клиент мержит точечно по id, не трогая
  // категории, которые пользователь мог параллельно редактировать локально (ещё не сохранены) —
  // полная карточка с сервера затёрла бы такие несохранённые правки.
  | { ok: true; status: "done"; categoryId: string; content: string }
  // Модель попросила уточнение (ask_user) — клиент показывает вопросы, отвечает или пропускает
  // через answerCardBlockQuestions (resumeBlock.ts); генерация приостановлена, cardLock НЕ снят.
  | { ok: true; status: "questions"; questions: AskUserQuestion[] }
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
 * При паузе на ask_user (status: "questions") лок остаётся захваченным до ответа/пропуска —
 * см. answerCardBlockQuestions (resumeBlock.ts) и TTL в cardLock.ts/pendingGeneration.ts.
 */
export async function generateCardBlock(
  userId: number,
  cardId: number,
  categoryId?: string,
): Promise<GenerateCardBlockResult> {
  const lockToken = tryLockCard(cardId);
  if (lockToken === false) return { ok: false, status: 409, reason: "busy" };
  const t0 = Date.now();

  const fail = (status: 400 | 404 | 409, reason: string): GenerateCardBlockResult => {
    unlockCard(cardId, lockToken);
    return { ok: false, status, reason };
  };

  try {
    const card = await getCard(userId, cardId);
    if (!card) return fail(404, "not_found");
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

    const outcome = await runCardGenerationToolLoop({
      baseOptions: completionOptions,
      history: assembled.messages,
      tavilyApiKey,
      maxSearchRounds,
      askUserEnabled: card.useAskUser,
    });

    if (!outcome.done) {
      // Синхронизируем возраст лока с возрастом pending-записи (см. touchCardLock) — иначе лок,
      // захваченный ДО этого (потенциально долгого) LLM-запроса, протух бы раньше самой паузы.
      touchCardLock(cardId, lockToken);
      setPendingGeneration(cardId, {
        userId,
        lockToken,
        targetCategoryId: assembled.targetCategoryId,
        history: outcome.history,
        toolCallId: outcome.toolCallId,
        questions: outcome.questions,
        completionOptions,
        tavilyApiKey,
        maxSearchRounds,
        searchesUsed: outcome.searchesUsed,
        askUserRoundsUsed: outcome.askUserRoundsUsed,
        createdAt: Date.now(),
      });
      return { ok: true, status: "questions", questions: outcome.questions };
    }

    const content = outcome.content.trim();
    const updated = await setCardCategoryContent(userId, cardId, assembled.targetCategoryId, content);
    if (!updated) return fail(404, "not_found");

    unlockCard(cardId, lockToken);
    logger.info(
      { durationMs: Date.now() - t0, userId, cardId, categoryId: assembled.targetCategoryId },
      "Card block generated",
    );
    return { ok: true, status: "done", categoryId: assembled.targetCategoryId, content };
  } catch (err) {
    unlockCard(cardId, lockToken);
    throw err;
  }
}
