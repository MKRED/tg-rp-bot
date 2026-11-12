import type { CoauthorProposal, CoauthorTurnLimits } from "@tg-rp-bot/shared";
import type { ResponsesContentPart, ResponsesInputItem } from "../../llm/responses/types.js";
import { buildSystemPrompt, cardsSnapshot, type CoauthorCardData } from "./prompt.js";
import type { StoredMessage } from "./state.js";
import { GET_CARDS_TOOL_NAME } from "./tools.js";
import { trimHistory } from "./trim.js";

const OPENING_USER = "I opened the workshop with some cards.";
const OPENING_ASSISTANT = "I have all the cards open. What would you like to change?";
const OPENING_CALL_ID = "get_cards_0";

export interface CoauthorInputParams {
  customPrompt: string;
  cards: CoauthorCardData[];
  proposals: CoauthorProposal[];
  history: StoredMessage[];
  historyTokenBudget: number;
  limits: CoauthorTurnLimits;
  withImages?: boolean;
}

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
export function buildCoauthorInput(params: CoauthorInputParams): ResponsesInputItem[] {
  const { customPrompt, cards, proposals, history, historyTokenBudget, limits, withImages = false } = params;
  const trimmed = trimHistory(history, historyTokenBudget);
  // Результат custom-вызова обязан быть custom_tool_call_output (DeepSeek проверяет пару), а хранимый
  // результат вида вызова не знает — сводим по call_id. Карта по всей видимой истории покрывает и
  // результаты, дописанные после паузы на вопросы (resolvePendingQuestions).
  const customCalls = new Set<string>();
  for (const m of trimmed) {
    if ("toolCalls" in m) for (const c of m.toolCalls) if (c.type === "custom") customCalls.add(c.id);
  }
  return [
    { role: "system", content: buildSystemPrompt(customPrompt, limits) },
    openingUserMessage(cards, withImages),
    { type: "function_call", call_id: OPENING_CALL_ID, name: GET_CARDS_TOOL_NAME, arguments: "{}" },
    { type: "function_call_output", call_id: OPENING_CALL_ID, output: cardsSnapshot(cards, proposals) },
    { role: "assistant", content: OPENING_ASSISTANT },
    ...trimmed.flatMap((m) => toInputItems(m, customCalls)),
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
 * требует), текст, затем по элементу на каждый вызов (function_call или custom_tool_call).
 */
function toInputItems(message: StoredMessage, customCalls: Set<string>): ResponsesInputItem[] {
  switch (message.role) {
    case "user":
      return [{ role: "user", content: message.review ? `[Review: ${message.review}]\n\n${message.content}` : message.content }];
    case "tool":
      return customCalls.has(message.toolCallId)
        ? [{ type: "custom_tool_call_output", call_id: message.toolCallId, output: message.content }]
        : [{ type: "function_call_output", call_id: message.toolCallId, output: message.content }];
    case "assistant": {
      if (!("toolCalls" in message)) return [{ role: "assistant", content: message.content }];
      const items: ResponsesInputItem[] = [];
      if (message.reasoning) items.push({ type: "reasoning", summary: [], content: [{ type: "reasoning_text", text: message.reasoning }] });
      if (message.content) items.push({ role: "assistant", content: message.content });
      for (const call of message.toolCalls) {
        items.push(
          call.type === "custom"
            ? { type: "custom_tool_call", call_id: call.id, name: call.function.name, input: call.function.arguments }
            : { type: "function_call", call_id: call.id, name: call.function.name, arguments: call.function.arguments },
        );
      }
      return items;
    }
  }
}
