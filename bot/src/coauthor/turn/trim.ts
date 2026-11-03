import { countTokens } from "../../utils/tokens.js";
import type { StoredMessage } from "./state.js";

/** Сколько токенов истории переписки уходит модели (без системного промпта и карточек). */
export const COAUTHOR_HISTORY_TOKEN_BUDGET = 40_000;

function messageTokens(message: StoredMessage): number {
  if (message.role === "tool") return countTokens(message.content);
  let tokens = countTokens(message.content ?? "");
  if ("toolCalls" in message) {
    for (const call of message.toolCalls) tokens += countTokens(call.function.name) + countTokens(call.function.arguments);
  }
  return tokens;
}

/**
 * Обрезает старую переписку под бюджет токенов. Режем только по границам ходов (ход = сообщение
 * пользователя и всё после него до следующего): так вызовы инструментов не отрываются от своих
 * результатов, а оставшаяся история всегда начинается с user — после стартового ответа assistant
 * в промпте роли не повторяются. Последний ход остаётся целиком, даже если сам больше бюджета.
 * Сообщения до первого user (их быть не должно) отбрасываются по той же причине.
 */
export function trimHistory(messages: StoredMessage[], budget: number): StoredMessage[] {
  const turns: StoredMessage[][] = [];
  for (const message of messages) {
    if (message.role === "user") turns.push([message]);
    else turns.at(-1)?.push(message);
  }

  const kept: StoredMessage[][] = [];
  let total = 0;
  for (let i = turns.length - 1; i >= 0; i--) {
    const turn = turns[i]!;
    const tokens = turn.reduce((sum, m) => sum + messageTokens(m), 0);
    if (kept.length > 0 && total + tokens > budget) break;
    kept.unshift(turn);
    total += tokens;
  }
  return kept.flat();
}
