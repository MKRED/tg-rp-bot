import { chatCompletion } from "../../../llm/client.js";
import type { ChatCompletionOptions, ToolCall } from "../../../llm/types.js";
import logger from "../../../logger.js";
import { TavilyHttpError } from "../../../tavily/errors.js";
import { tavilySearch, WEB_SEARCH_TOOL, WEB_SEARCH_TOOL_NAME } from "../../../tavily/webSearch.js";
import { ASK_USER_TOOL, ASK_USER_TOOL_NAME, parseAskUserArguments, type AskUserQuestion } from "./askUserTool.js";
import type { LoopMessage } from "./pendingGeneration.js";

/** Сколько раз модель может вызвать ask_user за одну генерацию блока (включая невалидные/повторные
 * вызовы) — защита от бесконечного диалога вопросов. В норме модель укладывает всё уточнение в
 * один вызов (см. ASK_USER_TOOL), поэтому лимит — только страховка, не рабочий бюджет. */
const ASK_USER_MAX_ROUNDS = 2;

interface WebSearchOutcome {
  content: string;
  /** Ключ Tavily невалиден/отозван (401/403) — ретраить его в следующих раундах бессмысленно. */
  authFailed: boolean;
}

/** Выполняет один tool_call веб-поиска (или отвечает ошибкой на неизвестное имя инструмента).
 * Ошибки (битые аргументы, сбой Tavily) уходят в content — модель узнаёт о неудаче тем же путём,
 * что и об успехе, и может ответить без этого результата, а не всей генерацией. */
async function runWebSearchCall(call: ToolCall, tavilyApiKey: string): Promise<WebSearchOutcome> {
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
    const authFailed = err instanceof TavilyHttpError && (err.status === 401 || err.status === 403);
    logger.error({ err, query, authFailed }, "Tavily search failed during card generation");
    return {
      content: JSON.stringify({ error: authFailed ? "invalid tavily api key" : "web search failed" }),
      authFailed,
    };
  }
}

export interface ToolLoopParams {
  baseOptions: Omit<ChatCompletionOptions, "messages" | "tools" | "toolChoice">;
  history: LoopMessage[];
  /** null — веб-поиск выключен на карточке или ключ Tavily не задан. */
  tavilyApiKey: string | null;
  maxSearchRounds: number;
  askUserEnabled: boolean;
  /** Резюме после ask_user — бюджеты продолжаются с прежних значений, а не с нуля. */
  searchesUsedStart?: number;
  askUserRoundsUsedStart?: number;
}

export type ToolLoopOutcome =
  | { done: true; content: string }
  | {
      done: false;
      history: LoopMessage[];
      toolCallId: string;
      questions: AskUserQuestion[];
      searchesUsed: number;
      askUserRoundsUsed: number;
    };

/**
 * Генерация блока карточки с function calling (web_search + ask_user, DeepSeek thinking-режим
 * совместим — проверено вручную, см. scripts/test-web-search.ts). Модели доступны только те
 * инструменты, чей бюджет ещё не исчерпан (searchesUsed < maxSearchRounds / askUserRoundsUsed <
 * ASK_USER_MAX_ROUNDS) — как только оба исчерпаны, следующий вызов уходит БЕЗ tools, что физически
 * не даёт модели запросить что-то ещё и вынуждает ответить тем, что уже есть (жёсткий серверный
 * кап, не полагаемся только на инструкцию в промпте).
 *
 * ask_user не резолвится внутри цикла (в отличие от web_search) — эта функция возвращается с
 * done: false, а вызывающий (generateBlock/resumeBlock) сохраняет history в pendingGeneration и
 * ждёт ответа пользователя через HTTP. Гарантия завершения цикла: любой ход с tool_calls[] либо
 * приостанавливает выполнение (return), либо поднимает searchesUsed/askUserRoundsUsed минимум на 1
 * за каждый tool_call в нём (web_search и неизвестные инструменты — searchesUsed, ask_user —
 * askUserRoundsUsed, даже если аргументы битые/повторные) — значит хотя бы один из бюджетов
 * неизбежно исчерпается не позже чем через maxSearchRounds + ASK_USER_MAX_ROUNDS ходов.
 */
export async function runCardGenerationToolLoop(params: ToolLoopParams): Promise<ToolLoopOutcome> {
  const { baseOptions, tavilyApiKey, maxSearchRounds, askUserEnabled } = params;
  const { userId } = baseOptions;
  const t0 = Date.now();

  const history: LoopMessage[] = [...params.history];
  let searchesUsed = params.searchesUsedStart ?? 0;
  let askUserRoundsUsed = params.askUserRoundsUsedStart ?? 0;
  let llmCalls = 0;

  for (;;) {
    const canSearch = tavilyApiKey !== null && searchesUsed < maxSearchRounds;
    const canAsk = askUserEnabled && askUserRoundsUsed < ASK_USER_MAX_ROUNDS;
    const tools = [...(canSearch ? [WEB_SEARCH_TOOL] : []), ...(canAsk ? [ASK_USER_TOOL] : [])];

    llmCalls++;
    const result = await chatCompletion({
      ...baseOptions,
      messages: history,
      ...(tools.length > 0 ? { tools, toolChoice: "auto" as const } : {}),
    });

    if (!result.toolCalls?.length || tools.length === 0) {
      logger.info(
        { userId, searchesUsed, askUserRoundsUsed, llmCalls, durationMs: Date.now() - t0 },
        "Card generation tool loop: завершено",
      );
      return { done: true, content: result.content };
    }

    history.push({ role: "assistant", content: result.content || null, tool_calls: result.toolCalls });

    let pausedOn: { toolCallId: string; questions: AskUserQuestion[] } | undefined;
    let authFailed = false;

    for (const call of result.toolCalls) {
      if (call.function.name === ASK_USER_TOOL_NAME) {
        // Считаем сам факт вызова независимо от валидности аргументов/повторности — иначе битые
        // аргументы не расходовали бы бюджет и цикл не был бы гарантированно конечным.
        askUserRoundsUsed++;
        if (pausedOn) {
          history.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ error: "only one ask_user call is processed per turn" }),
          });
          continue;
        }
        const questions = parseAskUserArguments(call.function.arguments);
        if (!questions) {
          logger.error({ rawArguments: call.function.arguments }, "ask_user tool_call: bad arguments");
          history.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ error: "invalid arguments" }),
          });
          continue;
        }
        pausedOn = { toolCallId: call.id, questions };
        continue;
      }

      const outcome = await runWebSearchCall(call, tavilyApiKey ?? "");
      history.push({ role: "tool", tool_call_id: call.id, content: outcome.content });
      searchesUsed++;
      if (outcome.authFailed) authFailed = true;
    }

    if (pausedOn) {
      logger.info(
        { userId, askUserRoundsUsed, questionsCount: pausedOn.questions.length, durationMs: Date.now() - t0 },
        "Card generation tool loop: пауза на ask_user",
      );
      return {
        done: false,
        history,
        toolCallId: pausedOn.toolCallId,
        questions: pausedOn.questions,
        searchesUsed,
        askUserRoundsUsed,
      };
    }

    if (authFailed) searchesUsed = maxSearchRounds; // не ретраим дальше — следующий ход уйдёт без web_search
  }
}
