import type { CoauthorProposal } from "@tg-rp-bot/shared";
import type { ResponsesContentPart, ResponsesInputItem } from "../../llm/responses/types.js";
import { buildSystemPrompt, cardsSnapshot, type CoauthorCardData } from "./prompt.js";
import type { StoredMessage } from "./state.js";
import { GET_CARDS_TOOL_NAME } from "./tools.js";
import { trimHistory } from "./trim.js";

const OPENING_USER = "I opened the workshop with some cards.";
const OPENING_ASSISTANT = "I have all the cards open. What would you like to change?";
const OPENING_CALL_ID = "get_cards_0";

/**
 * input запроса к модели (Responses API). Карточки уходят результатом синтетического вызова get_cards,
 * а не системным промптом: так модель воспринимает их как данные, которые она сама загрузила (проверено
 * пробами). Снимок пересобирается на каждый запрос — модель всегда видит текущие карточки, а в истории
 * старые снимки заменены заглушкой. Порядок: system → user → get_cards → результат → assistant → история;
 * история после обрезки начинается с user (trimHistory).
 *
 * Хранимая история (StoredMessage) остаётся в chat-формате — её пишут и старые чаты, — и переводится в
 * элементы Responses только здесь, при сборке запроса.
 */
export function buildCoauthorInput(
  customPrompt: string,
  cards: CoauthorCardData[],
  proposals: CoauthorProposal[],
  history: StoredMessage[],
  historyTokenBudget: number,
  withImages = false,
): ResponsesInputItem[] {
  return [
    { role: "system", content: buildSystemPrompt(customPrompt) },
    openingUserMessage(cards, withImages),
    { type: "function_call", call_id: OPENING_CALL_ID, name: GET_CARDS_TOOL_NAME, arguments: "{}" },
    { type: "function_call_output", call_id: OPENING_CALL_ID, output: cardsSnapshot(cards, proposals) },
    { role: "assistant", content: OPENING_ASSISTANT },
    ...trimHistory(history, historyTokenBudget).flatMap(toInputItems),
  ];
}

/**
 * Первое сообщение пользователя с картинками-референсами всех карточек — каждая группа с подписью, чья
 * она: модель связывает картинку с карточкой по имени и card_id. Сообщение стабильно, пока не меняются
 * сами картинки, — префикс промпта с ними попадает в кэш провайдера.
 */
function openingUserMessage(cards: CoauthorCardData[], withImages: boolean): ResponsesInputItem {
  const withRefs = withImages ? cards.filter((c) => c.images.length > 0) : [];
  if (withRefs.length === 0) return { role: "user", content: OPENING_USER };
  const parts: ResponsesContentPart[] = [{ type: "input_text", text: OPENING_USER }];
  for (const card of withRefs) {
    parts.push({ type: "input_text", text: `Reference images of ${card.name} (card_id ${card.id}) — how the character looks:` });
    for (const url of card.images) parts.push({ type: "input_image", image_url: url });
  }
  return { role: "user", content: parts };
}

/**
 * Сохранённое сообщение → элементы input. Вызов инструментов раскладывается в порядке, в каком модель
 * его выдаёт: рассуждение (только живое, внутри хода — сохранённым ходам оно не нужно, Responses его не
 * требует), текст, затем по function_call на каждый вызов.
 */
function toInputItems(message: StoredMessage): ResponsesInputItem[] {
  switch (message.role) {
    case "user":
      return [{ role: "user", content: message.review ? `[Review: ${message.review}]\n\n${message.content}` : message.content }];
    case "tool":
      return [{ type: "function_call_output", call_id: message.toolCallId, output: message.content }];
    case "assistant": {
      if (!("toolCalls" in message)) return [{ role: "assistant", content: message.content }];
      const items: ResponsesInputItem[] = [];
      if (message.reasoning) items.push({ type: "reasoning", summary: [], content: [{ type: "reasoning_text", text: message.reasoning }] });
      if (message.content) items.push({ role: "assistant", content: message.content });
      for (const call of message.toolCalls) {
        items.push({ type: "function_call", call_id: call.id, name: call.function.name, arguments: call.function.arguments });
      }
      return items;
    }
  }
}
