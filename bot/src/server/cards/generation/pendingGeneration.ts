import type { ChatCompletionOptions, ChatMessage, ToolCallMessage, ToolResultMessage } from "../../../llm/types.js";
import { CARD_LOCK_STALE_MS } from "../cards.constants.js";
import type { AskUserQuestion } from "./askUserTool.js";

export type LoopMessage = ChatMessage | ToolCallMessage | ToolResultMessage;

/**
 * Состояние генерации блока, приостановленной на ask_user (см. toolLoop.ts): сервер держит его
 * в памяти между запросом «вот вопросы» (generateCardBlock) и запросом «вот ответы»
 * (answerCardBlockQuestions), пока ждёт ответа пользователя из модалки на клиенте.
 * cardLock (cardLock.ts) остаётся захваченным всё это время — карточка занята, как при обычной
 * генерации; TTL синхронизирован с cardLock через общий CARD_LOCK_STALE_MS.
 */
export interface PendingCardGeneration {
  userId: number;
  /** Токен владения cardLock (см. cardLock.ts) — resumeBlock.ts обязан использовать именно его
   * для unlockCard/touchCardLock, а не только cardId: без токена resumeBlock мог бы втихую снять
   * или продлить чужой лок, если исходный протух и был перезахвачен другой операцией. */
  lockToken: number;
  targetCategoryId: string;
  history: LoopMessage[];
  /** tool_call_id вызова ask_user, ожидающего ответа — на него уходит tool-результат при резюме. */
  toolCallId: string;
  questions: AskUserQuestion[];
  completionOptions: Omit<ChatCompletionOptions, "messages" | "tools" | "toolChoice">;
  tavilyApiKey: string | null;
  maxSearchRounds: number;
  searchesUsed: number;
  askUserRoundsUsed: number;
  createdAt: number;
}

const pending = new Map<number, PendingCardGeneration>();

/** Вызывающий обязан вызвать touchCardLock(cardId) (cardLock.ts) непосредственно перед этим —
 * иначе возраст лока (взятого ДО потенциально долгого LLM-запроса) разойдётся с возрастом этой
 * записи (взятой ПОСЛЕ него), и лок протухнет раньше pending, ломая инвариант ниже. */
export function setPendingGeneration(cardId: number, state: PendingCardGeneration): void {
  pending.set(cardId, state);
}

/** undefined, если ожидания нет или оно протухло (заброшенная вкладка/сеть) — в обоих случаях
 * запись удаляется, а cardLock той же карточки скоро протухнет по тому же TTL и станет реюзабелен. */
export function getPendingGeneration(cardId: number): PendingCardGeneration | undefined {
  const state = pending.get(cardId);
  if (!state) return undefined;
  if (Date.now() - state.createdAt > CARD_LOCK_STALE_MS) {
    pending.delete(cardId);
    return undefined;
  }
  return state;
}

export function clearPendingGeneration(cardId: number): void {
  pending.delete(cardId);
}
