import type { CoauthorProposal, CoauthorTurnLimits } from "@tg-rp-bot/shared";
import type { ResponsesContentPart, ResponsesInputItem } from "../../llm/responses/types.js";
import { visibleHistory, type ReplayedCardResult } from "./card-context/index.js";
import { buildSystemPrompt, type CoauthorCardData } from "./prompt.js";
import type { StoredMessage } from "./state.js";

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
 * input запроса к модели (Responses API): system и история, обрезанная по ходам (начинается с user).
 * Карточек в промпте нет: в начале каждого хода в историю пишется синтетический list_cards (turn-loop.ts),
 * а тексты и картинки модель читает сама через get_card. Сохранённые результаты get_card реплеятся как есть
 * плюс картинки текущей карточки; устаревшие — заглушкой (card-context/replay.ts). Всё, что было отдано
 * модели внутри хода, в следующем раунде повторяется побайтно — префикс запроса попадает в кэш.
 *
 * Хранимая история (StoredMessage) остаётся в chat-формате — её пишут и старые чаты, — и переводится в
 * элементы Responses только здесь, при сборке запроса.
 */
export function buildCoauthorInput(params: CoauthorInputParams): ResponsesInputItem[] {
  const { customPrompt, cards, proposals, history, historyTokenBudget, limits, withImages = false } = params;
  const { history: trimmed, cardResults } = visibleHistory(history, cards, proposals, historyTokenBudget);
  // Результат custom-вызова обязан быть custom_tool_call_output (DeepSeek проверяет пару), а хранимый
  // результат вида вызова не знает — сводим по call_id. Карта по всей видимой истории покрывает и
  // результаты, дописанные после паузы на вопросы (resolvePendingQuestions).
  const customCalls = new Set<string>();
  for (const m of trimmed) {
    if ("toolCalls" in m) for (const c of m.toolCalls) if (c.type === "custom") customCalls.add(c.id);
  }
  const toolOutput = (m: Extract<StoredMessage, { role: "tool" }>) =>
    cardOutput(m.content, cardResults.get(m.toolCallId), withImages);
  // Рассуждения — только у текущего хода: там DeepSeek их требует (state.ts), у прошлых они лишние токены.
  const turnStart = trimmed.findLastIndex((m) => m.role === "user");
  return [
    { role: "system", content: buildSystemPrompt(customPrompt, limits) },
    ...trimmed.flatMap((m, i) => toInputItems(m, customCalls, toolOutput, i > turnStart)),
  ];
}

/**
 * Вывод результата чтения карточки: актуальный — сохранённый текст и картинки-референсы с подписью, чьи
 * они; устаревший — заглушка. Прочие результаты — как есть.
 */
function cardOutput(content: string, replay: ReplayedCardResult | undefined, withImages: boolean): string | ResponsesContentPart[] {
  if (!replay) return content;
  if (replay.kind === "stub") return replay.text;
  const { card } = replay;
  if (!withImages || card.images.length === 0) return content;
  return [
    { type: "input_text", text: content },
    { type: "input_text", text: `Reference images of ${card.name} (card_id ${card.id}) — how the character looks:` },
    ...card.images.map((url): ResponsesContentPart => ({ type: "input_image", image_url: url })),
  ];
}

/**
 * Сохранённое сообщение → элементы input. Вызов инструментов раскладывается в порядке, в каком модель
 * его выдаёт: рассуждение (если withReasoning), текст, затем по элементу на каждый вызов (function_call
 * или custom_tool_call).
 */
function toInputItems(
  message: StoredMessage,
  customCalls: Set<string>,
  toolOutput: (m: Extract<StoredMessage, { role: "tool" }>) => string | ResponsesContentPart[],
  withReasoning: boolean,
): ResponsesInputItem[] {
  switch (message.role) {
    case "user":
      return [{ role: "user", content: message.review ? `[Review: ${message.review}]\n\n${message.content}` : message.content }];
    case "tool":
      return customCalls.has(message.toolCallId)
        ? [{ type: "custom_tool_call_output", call_id: message.toolCallId, output: message.content }]
        : [{ type: "function_call_output", call_id: message.toolCallId, output: toolOutput(message) }];
    case "assistant": {
      if (!("toolCalls" in message)) return [{ role: "assistant", content: message.content }];
      const items: ResponsesInputItem[] = [];
      if (withReasoning && message.reasoning) items.push({ type: "reasoning", summary: [], content: [{ type: "reasoning_text", text: message.reasoning }] });
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
