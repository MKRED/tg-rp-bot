import type { CoauthorState } from "../state.js";
import type { CoauthorCardData } from "../prompt.js";
import { LIST_CARDS_TOOL_NAME } from "../tools.js";
import { COAUTHOR_HISTORY_TOKEN_BUDGET } from "../trim.js";
import { renderCardList } from "./render.js";
import { loadedCardIds } from "./replay.js";
import { visibleHistory } from "./visible.js";

/** Префикс id синтетического list_cards: его вызов — не действие модели, и в ленте шагом не показывается. */
export const AUTO_LIST_CALL_PREFIX = "list_cards_auto_";

export const isAutoListCall = (callId: string): boolean => callId.startsWith(AUTO_LIST_CALL_PREFIX);

/**
 * Начало хода: сразу после сообщения пользователя в историю пишется вызов list_cards с результатом, будто
 * модель сделала его сама, — так она без лишнего раунда знает, какие карточки открыты, какие уже прочитаны,
 * и читает нужные get_card. Вызов именно сохраняется, а не подставляется при сборке запроса: иначе прошлые
 * ходы теряли бы его, история менялась бы задним числом и кэш провайдера сбрасывался бы на каждом ходе.
 * По той же причине «прочитано» считается один раз — на начало хода — и дальше не меняется.
 * Продолжение хода после ответа на вопросы — не начало: последнее сообщение там не user.
 */
export function openTurnWithCardList(state: CoauthorState, cards: CoauthorCardData[]): void {
  if (state.messages.at(-1)?.role !== "user") return;
  const loaded = loadedCardIds(visibleHistory(state.messages, cards, state.proposals, COAUTHOR_HISTORY_TOKEN_BUDGET).cardResults);
  const id = `${AUTO_LIST_CALL_PREFIX}${state.messages.filter((m) => m.role === "user").length}`;
  state.messages.push(
    {
      role: "assistant",
      content: null,
      // Вызов в текущем ходе без рассуждения DeepSeek в режиме размышлений отклоняет (400) — даём своё.
      reasoning: "The user sent a new message. First, list the cards open in the workshop.",
      toolCalls: [{ id, type: "function", function: { name: LIST_CARDS_TOOL_NAME, arguments: "{}" } }],
    },
    { role: "tool", toolCallId: id, content: renderCardList(cards, loaded) },
  );
}
