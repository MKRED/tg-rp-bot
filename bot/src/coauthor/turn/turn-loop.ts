import type { CoauthorStep, WebSearchRecord } from "@tg-rp-bot/shared";
import { parseAskUserArguments } from "../../cards/generation/ask-user-tool.js";
import { runWebSearchCall } from "../../cards/generation/tool-loop.js";
import type { ResponsesCompleter, ResponsesRequestOptions } from "../../llm/responses/types.js";
import type { ToolCall } from "../../llm/types.js";
import logger from "../../logger.js";
import type { WebSearcher } from "../../web-search/web-search.types.js";
import { WEB_SEARCH_TOOL_NAME, webSearchTool } from "../../web-search/web-search-tool.js";
import { buildCoauthorInput } from "./input.js";
import { STALE_CARDS_RESULT, type CoauthorCardData } from "./prompt.js";
import { proposeEdit } from "./proposals.js";
import type { CoauthorState, StoredMessage } from "./state.js";
import { callStep } from "./steps.js";
import {
  ASK_USER_TOOL_NAME,
  COAUTHOR_ASK_USER_TOOL,
  EDIT_BLOCK_TOOL,
  EDIT_BLOCK_TOOL_NAME,
  GET_CARDS_TOOL,
  GET_CARDS_TOOL_NAME,
  parseEditBlockArguments,
} from "./tools.js";
import { COAUTHOR_HISTORY_TOKEN_BUDGET } from "./trim.js";

/** Вызовов модели за один запуск цикла; последний идёт без инструментов — ход гарантированно кончается. */
export const COAUTHOR_MAX_LLM_ROUNDS = 8;
/** Пауз на ask_user за одно сообщение пользователя — чтобы модель не затянула его в цепочку уточнений. */
export const COAUTHOR_MAX_ASK_PER_TURN = 2;
/** Вызовов edit_block за одно сообщение пользователя. */
export const COAUTHOR_MAX_EDITS_PER_TURN = 24;

export interface CoauthorTurnParams {
  /** Responses API: картинки разрешены и в результатах инструментов, не только в user-сообщениях. */
  llm: ResponsesCompleter;
  baseOptions: Omit<ResponsesRequestOptions, "input" | "tools" | "toolChoice">;
  customPrompt: string;
  cards: CoauthorCardData[];
  /** Меняется на месте: сюда дописываются сообщения хода, правки и пауза. */
  state: CoauthorState;
  webSearch: WebSearcher | null;
  maxSearchRounds: number;
  askUserEnabled: boolean;
  /** Отправлять картинки-референсы карточек: включено в чате и модель пресета их видит. */
  withImages: boolean;
  onWebSearch?: (record: WebSearchRecord) => void;
  /** Шаг начался или закончился. Правка уже записана в state.proposals к моменту шага с итоговым статусом. */
  onStep?: (step: CoauthorStep) => void;
  /** Кусок текста ответа модели. */
  onToken?: (text: string) => void;
  /** Модель перезапущена после сбоя: показанный текст и незавершённые шаги этой попытки недействительны. */
  onReset?: () => void;
}

export type CoauthorTurnOutcome = "done" | "questions";

/** Сообщения текущего хода — после последнего сообщения пользователя. */
function currentTurn(messages: StoredMessage[]): StoredMessage[] {
  let start = messages.length;
  while (start > 0 && messages[start - 1]!.role !== "user") start--;
  return messages.slice(start);
}

/** Сколько раз в текущем ходе вызывался инструмент — бюджеты считаются по самой истории. */
function callsInTurn(messages: StoredMessage[], name: string): number {
  let count = 0;
  for (const m of currentTurn(messages)) {
    if ("toolCalls" in m) count += m.toolCalls.filter((c) => c.function.name === name).length;
  }
  return count;
}

/**
 * Ход соавтора с function calling: get_cards, edit_block (правка = предложение, см. proposals.ts),
 * ask_user (пауза до ответа пользователя), web_search. tool_choice везде "auto": принудительный
 * выбор DeepSeek в thinking-режиме отклоняет.
 *
 * Пауза на ask_user возвращает "questions" и оставляет state.pending; продолжение — тот же вызов
 * после resolvePendingQuestions (questions.ts). Это возможно потому, что историю протокола хранит
 * сам чат, — в отличие от генерации карточек, где вопросы реплеятся синтетически.
 *
 * Конечность: не больше COAUTHOR_MAX_LLM_ROUNDS вызовов модели, последний — без инструментов;
 * паузы ограничены COAUTHOR_MAX_ASK_PER_TURN на сообщение пользователя.
 *
 * Модель всегда стримится: edit_block несёт весь текст блока, и шаг виден, пока он пишется, а не после.
 */
export async function runCoauthorTurn(params: CoauthorTurnParams): Promise<CoauthorTurnOutcome> {
  const { llm, baseOptions, customPrompt, cards, state, webSearch, maxSearchRounds, askUserEnabled, withImages } = params;
  const { userId } = baseOptions;
  const t0 = Date.now();

  // Шаг показывается один раз, как только его можно назвать; дальше аргументы только дописываются.
  const announced = new Set<string>();
  const announce = (call: { id: string; name: string; arguments: string }) => {
    if (announced.has(call.id)) return;
    const step = callStep(call);
    if (!step) return;
    announced.add(call.id);
    params.onStep?.(step);
  };

  for (let round = 1; ; round++) {
    const searchesUsed = callsInTurn(state.messages, WEB_SEARCH_TOOL_NAME);
    const tools =
      round < COAUTHOR_MAX_LLM_ROUNDS
        ? [
            GET_CARDS_TOOL,
            ...(callsInTurn(state.messages, EDIT_BLOCK_TOOL_NAME) < COAUTHOR_MAX_EDITS_PER_TURN ? [EDIT_BLOCK_TOOL] : []),
            ...(askUserEnabled && callsInTurn(state.messages, ASK_USER_TOOL_NAME) < COAUTHOR_MAX_ASK_PER_TURN
              ? [COAUTHOR_ASK_USER_TOOL]
              : []),
            ...(webSearch && searchesUsed < maxSearchRounds ? [webSearchTool(maxSearchRounds - searchesUsed)] : []),
          ]
        : [];

    const result = await llm.respond(
      {
        ...baseOptions,
        input: buildCoauthorInput(customPrompt, cards, state.proposals, state.messages, COAUTHOR_HISTORY_TOKEN_BUDGET, withImages),
        ...(tools.length > 0 && { tools, toolChoice: "auto" as const }),
      },
      (text) => params.onToken?.(text),
      () => {
        announced.clear();
        params.onReset?.();
      },
      announce,
    );

    logger.debug(
      { userId, round, offered: tools.map((t) => t.function.name), called: result.toolCalls?.map((c) => c.function.name) ?? [] },
      "Coauthor turn: раунд",
    );

    if (!result.toolCalls?.length || tools.length === 0) {
      state.messages.push({ role: "assistant", content: result.content.trim() });
      logger.info({ userId, rounds: round, durationMs: Date.now() - t0 }, "Coauthor turn: завершён");
      return "done";
    }

    state.messages.push({
      role: "assistant",
      content: result.content || null,
      toolCalls: result.toolCalls,
      ...(result.reasoningContent && { reasoning: result.reasoningContent }),
    });

    const offered = new Set(tools.map((t) => t.function.name));
    const results: Record<string, string> = {};
    let pause: { toolCallId: string; questions: NonNullable<ReturnType<typeof parseAskUserArguments>> } | undefined;
    let searchesLeft = maxSearchRounds - searchesUsed;

    const runCall = async (call: ToolCall): Promise<void> => {
      if (!offered.has(call.function.name)) {
        // Модель подсматривает вызовы в истории и зовёт выключенный или исчерпанный инструмент.
        logger.warn({ userId, tool: call.function.name }, "Coauthor turn: вызван непредложенный инструмент");
        results[call.id] = JSON.stringify({ error: `tool unavailable: ${call.function.name}` });
        return;
      }
      if (call.function.name === ASK_USER_TOOL_NAME) {
        const questions = pause ? undefined : parseAskUserArguments(call.function.arguments);
        if (questions) pause = { toolCallId: call.id, questions };
        else results[call.id] = JSON.stringify({ error: pause ? "only one ask_user call per turn" : "invalid arguments" });
        return;
      }
      if (call.function.name === WEB_SEARCH_TOOL_NAME) {
        if (searchesLeft <= 0 || !webSearch) {
          results[call.id] = JSON.stringify({ error: "search budget is used up", searches_left: 0 });
          return;
        }
        searchesLeft--;
        const outcome = await runWebSearchCall(call, webSearch, searchesLeft);
        results[call.id] = outcome.content;
        if (outcome.record) params.onWebSearch?.(outcome.record);
        if (outcome.authFailed) searchesLeft = 0;
        return;
      }
      results[call.id] = runLocalTool(call, state, cards);
    };

    const truncatedCallId = result.incompleteReason ? result.toolCalls.at(-1)!.id : undefined;
    for (const call of result.toolCalls) {
      const raw = { id: call.id, name: call.function.name, arguments: call.function.arguments };
      // Без стрима или без дельт шаг ещё не показан, а поиск идёт секунды — объявляем до запуска.
      announce(raw);
      if (call.id === truncatedCallId) {
        // Ответ оборван лимитом токенов на этом вызове — аргументы неполны. Не выполняем, а объясняем
        // модели причину: просто «invalid arguments» она повторила бы тем же длинным текстом.
        logger.warn({ userId, tool: call.function.name, reason: result.incompleteReason }, "Coauthor turn: вызов обрезан лимитом");
        results[call.id] = JSON.stringify({ error: "your output was cut off by the token limit; make this call again with shorter content" });
      } else {
        await runCall(call);
      }
      const finished = callStep(raw, results[call.id] ?? "{}");
      if (finished) params.onStep?.(finished);
    }

    if (pause) {
      state.pending = { toolCallId: pause.toolCallId, questions: pause.questions, results };
      logger.info({ userId, rounds: round, questions: pause.questions.length, durationMs: Date.now() - t0 }, "Coauthor turn: пауза на ask_user");
      return "questions";
    }
    for (const call of result.toolCalls) {
      state.messages.push({ role: "tool", toolCallId: call.id, content: results[call.id]! });
    }
  }
}

/** get_cards и edit_block — без внешних вызовов. */
function runLocalTool(call: ToolCall, state: CoauthorState, cards: CoauthorCardData[]): string {
  if (call.function.name === GET_CARDS_TOOL_NAME) {
    // Снимок в начале промпта пересобирается на каждый запрос (см. buildCoauthorInput) и уже
    // актуален — копии в истории только раздували бы её.
    return STALE_CARDS_RESULT;
  }
  const args = parseEditBlockArguments(call.function.arguments);
  if (!args) {
    logger.warn({ rawLength: call.function.arguments.length }, "Coauthor turn: битые аргументы edit_block");
    return JSON.stringify({ error: "invalid arguments: expected {card_id, block_id, content}" });
  }
  return proposeEdit(state, cards, args).content;
}
