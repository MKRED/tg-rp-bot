import { chatCompletion } from "../../../llm/client.js";
import type {
  ChatCompletionOptions,
  ChatMessage,
  ToolCall,
  ToolCallMessage,
  ToolResultMessage,
} from "../../../llm/types.js";
import logger from "../../../logger.js";
import { TavilyHttpError } from "../../../tavily/errors.js";
import { tavilySearch, WEB_SEARCH_TOOL, WEB_SEARCH_TOOL_NAME } from "../../../tavily/webSearch.js";

type LoopMessage = ChatMessage | ToolCallMessage | ToolResultMessage;

interface ToolCallOutcome {
  content: string;
  /** Ключ Tavily невалиден/отозван (401/403) — ретраить его в следующих раундах бессмысленно. */
  authFailed: boolean;
}

/** Инструкция без счётной формы существительного — не гоняемся за русским склонением по числу N. */
function searchInstruction(maxRounds: number): ChatMessage {
  return {
    role: "system",
    content:
      `Тебе доступен инструмент ${WEB_SEARCH_TOOL_NAME} для поиска актуальной информации в интернете. ` +
      `Используй его по необходимости. Лимит обращений к нему для этого блока: ${maxRounds}. ` +
      `Как только лимит будет исчерпан, инструмент станет недоступен — в этом случае дай финальный ` +
      `ответ на основе уже найденной информации, не проси пользователя повторить запрос.`,
  };
}

/** Выполняет один tool_call. Ошибки (битые аргументы, сбой Tavily) уходят в content — модель узнаёт
 * о неудаче тем же путём, что и об успехе, и может ответить без этого результата, а не всей генерацией. */
async function runToolCall(call: ToolCall, tavilyApiKey: string): Promise<ToolCallOutcome> {
  if (call.function.name !== WEB_SEARCH_TOOL_NAME) {
    return { content: JSON.stringify({ error: `unknown tool: ${call.function.name}` }), authFailed: false };
  }

  let query: string;
  try {
    const args = JSON.parse(call.function.arguments) as { query?: unknown };
    if (typeof args.query !== "string" || !args.query.trim()) throw new Error("query is missing");
    query = args.query;
  } catch (err) {
    logger.error({ err, rawArguments: call.function.arguments }, "Web search tool_call: bad arguments");
    return { content: JSON.stringify({ error: "invalid arguments" }), authFailed: false };
  }

  try {
    return { content: JSON.stringify(await tavilySearch(tavilyApiKey, query)), authFailed: false };
  } catch (err) {
    // 401/403 — ключ невалиден/отозван: дальнейшие раунды поиска обречены так же, форсируем
    // финальный ответ вместо того, чтобы жечь оставшийся бюджет раундов (и cardLock) на заведомый провал.
    const authFailed = err instanceof TavilyHttpError && (err.status === 401 || err.status === 403);
    logger.error({ err, query, authFailed }, "Tavily search failed during card generation");
    return {
      content: JSON.stringify({ error: authFailed ? "invalid tavily api key" : "web search failed" }),
      authFailed,
    };
  }
}

/**
 * Генерация блока карточки с веб-поиском (function calling, DeepSeek thinking-режим совместим —
 * проверено вручную, см. scripts/test-web-search.ts). Модели доступен tools, пока не исчерпан
 * бюджет maxRounds — считаем его по фактическим tool_calls (не по числу обращений к LLM: модель
 * может запросить несколько поисков за один ход, каждый идёт в счёт лимита отдельно). Как только
 * бюджет исчерпан (или ключ Tavily оказался невалиден — см. authFailed), следующий вызов идёт
 * БЕЗ tools, что физически не даёт модели запросить ещё один поиск и вынуждает ответить тем, что
 * уже нашла (жёсткий серверный кап, не полагаемся только на инструкцию в промпте).
 */
export async function generateCardBlockWithWebSearch(
  baseOptions: Omit<ChatCompletionOptions, "messages" | "tools" | "toolChoice">,
  messages: ChatMessage[],
  tavilyApiKey: string,
  maxRounds: number,
): Promise<string> {
  const t0 = Date.now();
  const { userId } = baseOptions;
  logger.info({ userId, maxRounds }, "Card web search: старт генерации блока");

  const history: LoopMessage[] = [...messages];
  history.splice(1, 0, searchInstruction(maxRounds));

  let searchesUsed = 0;
  let llmCalls = 0;
  // Гарантия завершения: canSearch=true требуется, чтобы продолжить цикл дальше очередного хода,
  // а каждый такой ход поднимает searchesUsed минимум на 1 (иначе была бы пустая tool_calls[],
  // а такой ход уже вернулся бы строкой выше) — значит canSearch неизбежно станет false не позже
  // чем через maxRounds ходов, и следующий (безынструментный) ход вернёт финальный ответ.
  for (;;) {
    const canSearch = searchesUsed < maxRounds;
    llmCalls++;
    const result = await chatCompletion({
      ...baseOptions,
      messages: history,
      ...(canSearch ? { tools: [WEB_SEARCH_TOOL], toolChoice: "auto" as const } : {}),
    });

    if (!result.toolCalls?.length || !canSearch) {
      logger.info(
        { userId, maxRounds, searchesUsed, llmCalls, durationMs: Date.now() - t0 },
        "Card web search: генерация блока завершена",
      );
      return result.content;
    }

    history.push({ role: "assistant", content: result.content || null, tool_calls: result.toolCalls });
    let authFailed = false;
    for (const call of result.toolCalls) {
      const outcome = await runToolCall(call, tavilyApiKey);
      history.push({ role: "tool", tool_call_id: call.id, content: outcome.content });
      searchesUsed++;
      if (outcome.authFailed) authFailed = true;
    }
    if (authFailed) searchesUsed = maxRounds; // не ретраим дальше — следующий ход уйдёт без tools
  }
}
