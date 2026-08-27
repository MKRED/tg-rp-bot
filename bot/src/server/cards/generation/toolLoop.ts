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
import { ASK_USER_TOOL, ASK_USER_TOOL_NAME, parseAskUserArguments, type AskUserQuestion } from "./askUserTool.js";

type LoopMessage = ChatMessage | ToolCallMessage | ToolResultMessage;

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
}

export type ToolLoopOutcome = { done: true; content: string } | { done: false; questions: AskUserQuestion[] };

/**
 * Генерация блока карточки с function calling (web_search + ask_user, DeepSeek thinking-режим
 * совместим — проверено вручную, см. scripts/test-web-search.ts). Модели доступны только те
 * инструменты, чей бюджет ещё не исчерпан (searchesUsed < maxSearchRounds / askUserRoundsUsed <
 * ASK_USER_MAX_ROUNDS) — как только оба исчерпаны, следующий вызов уходит БЕЗ tools, что физически
 * не даёт модели запросить что-то ещё и вынуждает ответить тем, что уже есть (жёсткий серверный
 * кап, не полагаемся только на инструкцию в промпте).
 *
 * ask_user не резолвится внутри цикла (в отличие от web_search) — эта функция возвращается с
 * done: false и только вопросами. Вызывающий (generateBlock.ts/answerQuestions.ts) НЕ резюмирует
 * этот же LLM-разговор: он сохраняет вопросы на самой категории (см. schema.types.ts) и, получив
 * ответ, просто заново вызывает эту функцию с прогнанным через assembleCardBlockPrompt промптом,
 * где ответы реплеятся заново синтетической парой assistant tool_calls(ask_user)/tool-result (см.
 * promptAssembly.ts) — без хранения исходного tool_call/tool_result между HTTP-запросами (некому
 * было бы гарантировать, что такая история останется валидной для протокола провайдера).
 * Бюджет ask_user (askUserRoundsUsed/ASK_USER_MAX_ROUNDS) — только страховка ВНУТРИ одного такого
 * вызова; сквозь несколько HTTP-раундов ответа сервер ограничивает число вопросов иначе, гейтя
 * askUserEnabled по накопленному askUserAnswers.length категории (см. generateBlock.ts,
 * ASK_USER_MAX_ANSWERED_QUESTIONS).
 *
 * Гарантия завершения цикла: любой ход с tool_calls[] либо приостанавливает выполнение (return),
 * либо поднимает searchesUsed/askUserRoundsUsed минимум на 1 за каждый tool_call в нём (web_search
 * и неизвестные инструменты — searchesUsed, ask_user — askUserRoundsUsed, даже если аргументы
 * битые/повторные) — значит хотя бы один из бюджетов неизбежно исчерпается не позже чем через
 * maxSearchRounds + ASK_USER_MAX_ROUNDS ходов.
 */
export async function runCardGenerationToolLoop(params: ToolLoopParams): Promise<ToolLoopOutcome> {
  const { baseOptions, tavilyApiKey, maxSearchRounds, askUserEnabled } = params;
  const { userId } = baseOptions;
  const t0 = Date.now();

  const history: LoopMessage[] = [...params.history];
  let searchesUsed = 0;
  let askUserRoundsUsed = 0;
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

    // reasoning_content — обязателен для DeepSeek thinking-режима на КАЖДОМ следующем запросе, где
    // это assistant-сообщение снова попадёт в историю (иначе 400, см. ToolCallMessage в llm/types.ts,
    // подтверждено ручным запросом к DeepSeek). В живом thinking-ответе с tool_calls DeepSeek САМ
    // возвращает reasoning_content (тоже подтверждено запросом) — result.reasoningContent должен
    // быть заполнен; заглушка ниже — не рабочий путь, а страховка на случай, если конкретный ответ
    // его всё же не вернёт (проверено, что лишнее поле безвредно и при отключённом thinking).
    history.push({
      role: "assistant",
      content: result.content || null,
      tool_calls: result.toolCalls,
      reasoning_content: result.reasoningContent ?? "Calling a tool to complete this response.",
    });

    let pausedQuestions: AskUserQuestion[] | undefined;
    let authFailed = false;

    for (const call of result.toolCalls) {
      if (call.function.name === ASK_USER_TOOL_NAME) {
        // Считаем сам факт вызова независимо от валидности аргументов/повторности — иначе битые
        // аргументы не расходовали бы бюджет и цикл не был бы гарантированно конечным.
        askUserRoundsUsed++;
        if (pausedQuestions) {
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
        pausedQuestions = questions;
        continue;
      }

      const outcome = await runWebSearchCall(call, tavilyApiKey ?? "");
      history.push({ role: "tool", tool_call_id: call.id, content: outcome.content });
      searchesUsed++;
      if (outcome.authFailed) authFailed = true;
    }

    if (pausedQuestions) {
      logger.info(
        { userId, askUserRoundsUsed, questionsCount: pausedQuestions.length, durationMs: Date.now() - t0 },
        "Card generation tool loop: пауза на ask_user",
      );
      return { done: false, questions: pausedQuestions };
    }

    if (authFailed) searchesUsed = maxSearchRounds; // не ретраим дальше — следующий ход уйдёт без web_search
  }
}
