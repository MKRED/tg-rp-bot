import { applyCardCategoryAnswers, getCard } from "../../../db/cards/index.js";
import logger from "../../../logger.js";
import { tryLockCard, unlockCard } from "../cardLock.js";
import { ASK_USER_DECLINED_ANSWER, type AskUserAnswer } from "./askUserTool.js";
import { generateCardBlock, type GenerateCardBlockResult } from "./generateBlock.js";

export type AnswerCardBlockQuestionsInput = { skipped: true } | { skipped: false; answers: string[] };

/**
 * Записывает ответы (или отказ) на уточняющие вопросы ask_user одной категории и запускает
 * генерацию этого же блока заново (см. generateCardBlock) — как «Перегенерировать» с явным
 * categoryId, только с уже известными ответами в контексте (assembleCardBlockPrompt реплеит их
 * из card.categories[].askUserAnswers как синтетический tool_call/tool_result, см.
 * promptAssembly.ts). Это НЕ резюме того же LLM-разговора: сервер не хранит исходный tool_call
 * модели (id, порядок раундов) — только пары вопрос-ответ живут в самой карточке (см.
 * schema.types.ts), а не в состоянии процесса, поэтому у пользователя нет ограничения по времени
 * на ответ, а cardLock не держится, пока он думает (см. cardLock.ts).
 *
 * cardLock здесь держится ТОЛЬКО вокруг чтения+записи ответов (getCard/applyCardCategoryAnswers —
 * тот же read-modify-write полной строки, что и у updateCard/setCardCategoryContent, иначе
 * конкурентный PUT /:id в это окно тихо потерял бы одну из записей) и снимается ДО вызова
 * generateCardBlock — лок не реентерабелен (обычный Set, см. cardLock.ts), а generateCardBlock
 * берёт его сам на время генерации; удержание здесь же привело бы к гарантированному "busy" на
 * каждый ответ на вопрос.
 */
export async function answerCardBlockQuestions(
  userId: number,
  cardId: number,
  categoryId: string,
  input: AnswerCardBlockQuestionsInput,
): Promise<GenerateCardBlockResult> {
  const t0 = Date.now();
  if (!tryLockCard(cardId)) return { ok: false, status: 409, reason: "busy" };

  let answeredCount: number;
  try {
    const card = await getCard(userId, cardId);
    if (!card) return { ok: false, status: 404, reason: "not_found" };

    const category = card.categories.find((c) => c.id === categoryId);
    const pending = category?.pendingQuestions;
    if (!pending || pending.length === 0) {
      // Вопрос уже неактуален — ответили в другой вкладке, категория удалена/выключена в форме,
      // либо запрос пришёл повторно. Ничего не трогаем, клиент предложит сгенерировать блок заново.
      logger.warn({ userId, cardId, categoryId }, "Ответ на ask_user: вопрос уже неактуален");
      return { ok: false, status: 404, reason: "no_pending_question" };
    }
    if (!input.skipped && input.answers.length !== pending.length) {
      logger.warn(
        { userId, cardId, categoryId, expected: pending.length, got: input.answers.length },
        "Ответ на ask_user: число ответов не совпадает с числом вопросов",
      );
      return { ok: false, status: 400, reason: "answers_mismatch" };
    }

    const answers: AskUserAnswer[] = pending.map((q, i) => ({
      question: q.question,
      answer: input.skipped ? ASK_USER_DECLINED_ANSWER : input.answers[i]!,
    }));
    answeredCount = answers.length;

    const updated = await applyCardCategoryAnswers(userId, cardId, categoryId, answers);
    if (!updated) return { ok: false, status: 404, reason: "not_found" };
  } finally {
    unlockCard(cardId);
  }

  const result = await generateCardBlock(userId, cardId, categoryId);
  logger.info(
    {
      userId,
      cardId,
      categoryId,
      answeredCount,
      skipped: input.skipped,
      status: result.status,
      durationMs: Date.now() - t0,
    },
    "Ask_user: ответы сохранены, генерация блока резюмирована",
  );
  return result;
}
