import { setCardCategoryContent } from "../../../db/cards/index.js";
import logger from "../../../logger.js";
import { touchCardLock, unlockCard } from "../cardLock.js";
import type { GenerateCardBlockResult } from "./generateBlock.js";
import { clearPendingGeneration, getPendingGeneration, setPendingGeneration } from "./pendingGeneration.js";
import { runCardGenerationToolLoop } from "./toolLoop.js";

export type AnswerCardBlockQuestionsInput = { skipped: true } | { skipped: false; answers: string[] };

/**
 * Резюмирует генерацию блока, приостановленную на ask_user (см. generateBlock.ts/toolLoop.ts):
 * дописывает ответ пользователя как tool-результат в сохранённую историю и продолжает цикл.
 * cardLock уже захвачен с момента исходного generateCardBlock — здесь его не берём повторно,
 * только снимаем на выходе (кроме случая новой паузы, когда пользователю снова есть что ответить).
 */
export async function answerCardBlockQuestions(
  userId: number,
  cardId: number,
  input: AnswerCardBlockQuestionsInput,
): Promise<GenerateCardBlockResult> {
  const t0 = Date.now();
  const pending = getPendingGeneration(cardId);
  if (!pending || pending.userId !== userId) {
    return { ok: false, status: 404, reason: "no_pending_question" };
  }
  if (!input.skipped && input.answers.length !== pending.questions.length) {
    // Лок держится с исходного generateCardBlock — при отказе снимаем его сами, иначе карточка
    // осталась бы залоченной (не сохранить, не сгенерировать) до протухания TTL без причины.
    clearPendingGeneration(cardId);
    unlockCard(cardId, pending.lockToken);
    return { ok: false, status: 400, reason: "answers_mismatch" };
  }

  // Снимаем сразу: если цикл ниже снова приостановится на ask_user, запишем новую запись сами.
  clearPendingGeneration(cardId);

  const toolResultContent = input.skipped
    ? JSON.stringify({ note: "user declined to answer" })
    : JSON.stringify({
        answers: pending.questions.map((q, i) => ({ question: q.question, answer: input.answers[i] })),
      });

  const history = [
    ...pending.history,
    { role: "tool" as const, tool_call_id: pending.toolCallId, content: toolResultContent },
  ];

  try {
    const outcome = await runCardGenerationToolLoop({
      baseOptions: pending.completionOptions,
      history,
      tavilyApiKey: pending.tavilyApiKey,
      maxSearchRounds: pending.maxSearchRounds,
      askUserEnabled: true,
      searchesUsedStart: pending.searchesUsed,
      askUserRoundsUsedStart: pending.askUserRoundsUsed,
    });

    if (!outcome.done) {
      // Синхронизируем возраст лока с возрастом новой pending-записи — та же причина, что в
      // generateBlock.ts (touchCardLock).
      touchCardLock(cardId, pending.lockToken);
      setPendingGeneration(cardId, {
        ...pending,
        history: outcome.history,
        toolCallId: outcome.toolCallId,
        questions: outcome.questions,
        searchesUsed: outcome.searchesUsed,
        askUserRoundsUsed: outcome.askUserRoundsUsed,
        createdAt: Date.now(),
      });
      return { ok: true, status: "questions", questions: outcome.questions };
    }

    const content = outcome.content.trim();
    const updated = await setCardCategoryContent(userId, cardId, pending.targetCategoryId, content);
    if (!updated) {
      unlockCard(cardId, pending.lockToken);
      return { ok: false, status: 404, reason: "not_found" };
    }

    unlockCard(cardId, pending.lockToken);
    logger.info(
      { durationMs: Date.now() - t0, userId, cardId, categoryId: pending.targetCategoryId },
      "Card block generated (после ответа на ask_user)",
    );
    return { ok: true, status: "done", categoryId: pending.targetCategoryId, content };
  } catch (err) {
    unlockCard(cardId, pending.lockToken);
    throw err;
  }
}
