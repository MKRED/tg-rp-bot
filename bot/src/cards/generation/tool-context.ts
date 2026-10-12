import type { CardCategory } from "@tg-rp-bot/shared";
import type { ToolCallMessage, ToolResultMessage } from "../../llm/types.js";
import { WEB_SEARCH_TOOL_NAME } from "../../tavily/web-search-tool.js";
import { countTokens } from "../../utils/tokens.js";
import { ASK_USER_TOOL_NAME } from "./ask-user-tool.js";

export type ToolContextMessage = ToolCallMessage | ToolResultMessage;

/**
 * Реплей сохранённого контекста инструментов категории (webSearches + askUserAnswers, см.
 * CardCategory в @tg-rp-bot/shared) КАК НАСТОЯЩИХ tool_call/tool_result: синтетический assistant-ход
 * с tool_calls и tool-сообщения с результатами сразу за ним. Модель должна видеть, что это
 * результаты ЕЁ ЖЕ вызовов инструментов, а не текст, будто пользователь сам где-то это сказал.
 * Сервер хранит только суть (запрос+результаты поиска, пары вопрос-ответ), не исходные tool_call
 * модели — поэтому и id, и обёртка вызова здесь синтетические, восстановленные заново; провайдеру
 * важно только совпадение id между tool_calls и tool_call_id, не его происхождение.
 *
 * Поиски идут перед вопросами — фиксированный порядок, а не реальная хронология (её сервер не
 * хранит): сообщения детерминированы содержимым категории, поэтому префикс промпта стабилен между
 * запросами соседних блоков и попадает в кэш провайдера.
 *
 * Пустой массив — контекста у категории нет.
 */
export function buildToolContextMessages(category: CardCategory): ToolContextMessage[] {
  return [...webSearchExchange(category), ...askUserExchange(category)];
}

/**
 * Сколько токенов контекст инструментов категории занимает в промпте — считаем по тем же
 * сообщениям, что реально уходят модели (buildToolContextMessages), чтобы число на экране не
 * расходилось с запросом. Это вклад ОДНОГО блока: запрос на блок N несёт сумму по всем блокам до него.
 */
export function countToolContextTokens(category: CardCategory): number {
  let tokens = 0;
  for (const message of buildToolContextMessages(category)) {
    if (message.role === "tool") {
      tokens += countTokens(message.content);
      continue;
    }
    tokens += countTokens(message.reasoning_content ?? "");
    for (const call of message.tool_calls) {
      tokens += countTokens(call.function.name) + countTokens(call.function.arguments);
    }
  }
  return tokens;
}

/** Категории с посчитанным toolContextTokens — для выдачи карточки клиенту (в БД поле не пишется). */
export function withToolContextTokens(categories: CardCategory[]): CardCategory[] {
  return categories.map((c) => ({ ...c, toolContextTokens: countToolContextTokens(c) }));
}

/**
 * Сохранённые веб-поиски категории: один assistant-ход со всеми вызовами web_search и по
 * tool-сообщению на каждый. content результата — тот же JSON, что модель получила вживую
 * (см. runWebSearchCall в tool-loop.ts).
 */
function webSearchExchange(category: CardCategory): ToolContextMessage[] {
  const searches = category.webSearches;
  if (!searches || searches.length === 0) return [];
  const callId = (index: number) => `web_search_${category.id}_${index}`;
  return [
    {
      role: "assistant",
      content: null,
      // DeepSeek thinking-режим требует reasoning_content на ЛЮБОМ assistant-сообщении с tool_calls в
      // истории, даже синтетическом (без него — 400 "reasoning_content in the thinking mode must be
      // passed back", подтверждено ручным запросом к DeepSeek) — реальных «мыслей» модели за этим
      // вызовом сервер не хранит, поэтому здесь заглушка.
      reasoning_content: "Searching the web for up-to-date information before generating this block.",
      tool_calls: searches.map((s, index) => ({
        id: callId(index),
        type: "function" as const,
        function: { name: WEB_SEARCH_TOOL_NAME, arguments: JSON.stringify({ query: s.query }) },
      })),
    },
    ...searches.map(
      (s, index): ToolResultMessage => ({
        role: "tool",
        tool_call_id: callId(index),
        content: JSON.stringify(s.results),
      }),
    ),
  ];
}

/**
 * Накопленные askUserAnswers категории: вызов ask_user с вопросами как аргументами и tool-результат
 * с ответами. Аргументы восстанавливаются ВКЛЮЧАЯ options — их отбрасывание показывало бы модели,
 * что её же прошлые вызовы ask_user никогда не предлагали варианты, и она по шаблону переставала бы
 * предлагать их дальше в этом же диалоге.
 */
function askUserExchange(category: CardCategory): ToolContextMessage[] {
  const answers = category.askUserAnswers;
  if (!answers || answers.length === 0) return [];
  const toolCallId = `ask_user_${category.id}`;
  return [
    {
      role: "assistant",
      content: null,
      // Заглушка по той же причине, что и в webSearchExchange.
      reasoning_content: "Deciding to ask the user a clarifying question before generating this block.",
      tool_calls: [
        {
          id: toolCallId,
          type: "function",
          function: {
            name: ASK_USER_TOOL_NAME,
            arguments: JSON.stringify({
              questions: answers.map((a) => ({ question: a.question, options: a.options })),
            }),
          },
        },
      ],
    },
    {
      role: "tool",
      tool_call_id: toolCallId,
      content: JSON.stringify({
        answers: answers.map((a) => ({ question: a.question, answer: a.answer })),
        note: "These have already been answered — don't call ask_user again for the same information.",
      }),
    },
  ];
}
