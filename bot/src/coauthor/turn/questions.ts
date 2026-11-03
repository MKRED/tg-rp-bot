import type { CoauthorAnswerInput } from "@tg-rp-bot/shared";
import { ASK_USER_DECLINED_ANSWER } from "../../cards/generation/ask-user-tool.js";
import type { CoauthorState, PendingQuestions } from "./state.js";

/**
 * Результат вызова ask_user с ответами пользователя. Пустой ответ — вопрос оставлен без ответа:
 * модели уходит явный отказ, а не пустая строка (иначе она переспросит то же самое).
 * null — число ответов не совпадает с числом вопросов.
 */
export function askUserResult(pending: PendingQuestions, input: CoauthorAnswerInput): string | null {
  if (!input.skipped && input.answers.length !== pending.questions.length) return null;
  const answers = pending.questions.map((q, i) => ({
    question: q.question,
    answer: (input.skipped ? "" : input.answers[i]!.trim()) || ASK_USER_DECLINED_ANSWER,
  }));
  const note = input.note?.trim();
  return JSON.stringify({
    answers,
    ...(input.skipped && { skipped: true }),
    ...(note && { additional_user_instructions: note }),
  });
}

/**
 * Закрывает ожидающие вопросы: дописывает tool-результаты всех вызовов прерванного хода в порядке
 * самих вызовов (у каждого tool_call должен быть результат), ответ на ask_user — среди них.
 * Меняет state на месте.
 */
export function resolvePendingQuestions(state: CoauthorState, askResult: string): void {
  const pending = state.pending;
  if (!pending) return;
  const last = state.messages.at(-1);
  const calls = last && "toolCalls" in last ? last.toolCalls : [];
  for (const call of calls) {
    const content = call.id === pending.toolCallId ? askResult : pending.results[call.id];
    state.messages.push({
      role: "tool",
      toolCallId: call.id,
      content: content ?? JSON.stringify({ error: "not executed" }),
    });
  }
  delete state.pending;
}
