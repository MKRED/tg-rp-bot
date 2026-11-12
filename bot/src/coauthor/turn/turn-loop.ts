import type { CoauthorStep, CoauthorTurnLimits, WebSearchRecord } from "@tg-rp-bot/shared";
import { parseAskUserArguments } from "../../cards/generation/ask-user-tool.js";
import { runWebSearchCall } from "../../cards/generation/tool-loop.js";
import { responsesToolName } from "../../llm/responses/request.js";
import type { ResponsesCompleter, ResponsesRequestOptions, ResponsesTool } from "../../llm/responses/types.js";
import type { ToolCall } from "../../llm/types.js";
import logger from "../../logger.js";
import type { WebSearcher } from "../../web-search/web-search.types.js";
import { WEB_SEARCH_TOOL_NAME, webSearchTool } from "../../web-search/web-search-tool.js";
import { callsInTurn, editsInTurn, withBudget } from "./budget.js";
import { buildCoauthorInput } from "./input.js";
import { loadedCardIds, openTurnWithCardList, visibleHistory } from "./card-context/index.js";
import { runLocalTool } from "./local-tools.js";
import type { CoauthorCardData } from "./prompt.js";
import type { CoauthorState } from "./state.js";
import { callSteps } from "./steps.js";
import {
  APPLY_PATCH_TOOL,
  ASK_USER_TOOL_NAME,
  COAUTHOR_ASK_USER_TOOL,
  EDIT_BLOCK_TOOL,
  GET_CARD_TOOL,
  LEGACY_GET_CARDS_TOOL_NAME,
  LIST_CARDS_TOOL,
} from "./tools.js";
import { COAUTHOR_HISTORY_TOKEN_BUDGET } from "./trim.js";

export interface CoauthorTurnParams {
  /** Responses API: картинки разрешены и в результатах инструментов, не только в user-сообщениях. */
  llm: ResponsesCompleter;
  baseOptions: Omit<ResponsesRequestOptions, "input" | "tools" | "toolChoice">;
  customPrompt: string;
  cards: CoauthorCardData[];
  /** Меняется на месте: сюда дописываются сообщения хода, правки и пауза. */
  state: CoauthorState;
  /** Лимиты хода из настроек чата. */
  limits: CoauthorTurnLimits;
  webSearch: WebSearcher | null;
  maxSearchRounds: number;
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

/**
 * Ход соавтора с function calling: list_cards и get_card (чтение карточек, card-context/), edit_block и
 * apply_patch (правка = предложение, см. proposals.ts, patch-proposals.ts; только по прочитанной карточке), ask_user (пауза до ответа пользователя), web_search. tool_choice
 * везде "auto": принудительный выбор DeepSeek в thinking-режиме отклоняет.
 *
 * Пауза на ask_user возвращает "questions" и оставляет state.pending; продолжение — тот же вызов
 * после resolvePendingQuestions (questions.ts). Это возможно потому, что историю протокола хранит
 * сам чат, — в отличие от генерации карточек, где вопросы реплеятся синтетически.
 *
 * Лимиты (limits, настройка чата): не больше maxRounds вызовов модели за запуск цикла, последний — без
 * инструментов, поэтому ход гарантированно кончается. Правки и вопросы при исчерпании не прячутся, а
 * отвечают модели ошибкой с объяснением — она заканчивает ход сама и говорит пользователю, что осталось.
 * Остаток бюджета дописывается в каждый результат инструмента (budget.ts).
 *
 * Модель всегда стримится: edit_block несёт весь текст блока, и шаг виден, пока он пишется, а не после.
 */
export async function runCoauthorTurn(params: CoauthorTurnParams): Promise<CoauthorTurnOutcome> {
  const { llm, baseOptions, customPrompt, cards, state, limits, webSearch, maxSearchRounds, withImages } = params;
  const { userId } = baseOptions;
  const t0 = Date.now();

  // Шаг показывается один раз, как только его можно назвать; дальше аргументы только дописываются. У
  // apply_patch шагов несколько (по блоку), они появляются по мере того, как пишется патч.
  const announced = new Map<string, CoauthorStep>();
  const announce = (call: { id: string; name: string; arguments: string }) => {
    for (const step of callSteps(call)) {
      if (announced.has(step.id)) continue;
      announced.set(step.id, step);
      params.onStep?.(step);
    }
  };

  openTurnWithCardList(state, cards);

  for (let round = 1; ; round++) {
    // Какие карточки модель видит прочитанными — по той же обрезанной истории, что уйдёт в запрос, и до
    // вызовов этого раунда: прочитанное сейчас она увидит только в следующем.
    const loaded = loadedCardIds(visibleHistory(state.messages, cards, state.proposals, COAUTHOR_HISTORY_TOKEN_BUDGET).cardResults);
    const searchesUsed = callsInTurn(state.messages, WEB_SEARCH_TOOL_NAME);
    const tools: ResponsesTool[] =
      round < limits.maxRounds
        ? [
            LIST_CARDS_TOOL,
            GET_CARD_TOOL,
            EDIT_BLOCK_TOOL,
            APPLY_PATCH_TOOL,
            COAUTHOR_ASK_USER_TOOL,
            ...(webSearch && searchesUsed < maxSearchRounds ? [webSearchTool(maxSearchRounds - searchesUsed)] : []),
          ]
        : [];

    const result = await llm.respond(
      {
        ...baseOptions,
        input: buildCoauthorInput({
          customPrompt,
          cards,
          proposals: state.proposals,
          history: state.messages,
          historyTokenBudget: COAUTHOR_HISTORY_TOKEN_BUDGET,
          limits,
          withImages,
        }),
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
      { userId, round, offered: tools.map(responsesToolName), called: result.toolCalls?.map((c) => c.function.name) ?? [] },
      "Coauthor turn: раунд",
    );

    if (!result.toolCalls?.length || tools.length === 0) {
      state.messages.push({ role: "assistant", content: result.content.trim() });
      logger.info({ userId, rounds: round, durationMs: Date.now() - t0 }, "Coauthor turn: завершён");
      return "done";
    }

    // Бюджеты — по истории до вызовов этого раунда (они сейчас лягут в историю).
    let editsUsed = editsInTurn(state.messages);
    const questionsUsed = callsInTurn(state.messages, ASK_USER_TOOL_NAME);
    state.messages.push({
      role: "assistant",
      content: result.content || null,
      toolCalls: result.toolCalls,
      ...(result.reasoningContent && { reasoning: result.reasoningContent }),
    });

    const offered = new Set(tools.map(responsesToolName));
    const results: Record<string, string> = {};
    let pause: { toolCallId: string; questions: NonNullable<ReturnType<typeof parseAskUserArguments>> } | undefined;
    let searchesLeft = maxSearchRounds - searchesUsed;

    const runCall = async (call: ToolCall): Promise<void> => {
      if (!offered.has(call.function.name)) {
        // Модель подсматривает вызовы в истории и зовёт выключенный или исчерпанный инструмент.
        logger.warn({ userId, tool: call.function.name }, "Coauthor turn: вызван непредложенный инструмент");
        const hint = call.function.name === LEGACY_GET_CARDS_TOOL_NAME ? " — use list_cards and get_card" : "";
        results[call.id] = JSON.stringify({ error: `tool unavailable: ${call.function.name}${hint}` });
        return;
      }
      if (call.function.name === ASK_USER_TOOL_NAME) {
        if (questionsUsed >= limits.maxQuestions) {
          results[call.id] = JSON.stringify({
            error: `the ask_user limit for this turn is used up (${limits.maxQuestions}) — decide yourself, or ask in your final message`,
          });
          return;
        }
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
      const outcome = runLocalTool(call, { state, cards, loaded, editsLeft: limits.maxEdits - editsUsed, maxEdits: limits.maxEdits });
      editsUsed += outcome.edits;
      results[call.id] = outcome.content;
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
      finishSteps(raw, results[call.id] ?? "{}", announced, params.onStep);
    }

    // Остаток бюджета — в каждый результат раунда; rounds_left — сколько ещё вызовов модели с инструментами.
    const budget = { edits_left: Math.max(0, limits.maxEdits - editsUsed), rounds_left: Math.max(0, limits.maxRounds - 1 - round) };
    for (const id of Object.keys(results)) results[id] = withBudget(results[id]!, budget);

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

/**
 * Итоговые статусы шагов вызова. Шаг, объявленный по ходу стрима, но пропавший из итога (патч оказался
 * битым и путь не разобрался), закрывается как failed — иначе он висел бы «в работе» до конца хода.
 */
function finishSteps(
  call: { id: string; name: string; arguments: string },
  result: string,
  announced: Map<string, CoauthorStep>,
  onStep: ((step: CoauthorStep) => void) | undefined,
): void {
  const finished = callSteps(call, result);
  for (const step of finished) onStep?.(step);
  const finishedIds = new Set(finished.map((s) => s.id));
  for (const [id, step] of announced) {
    const ofThisCall = id === call.id || id.startsWith(`${call.id}:`);
    if (ofThisCall && !finishedIds.has(id) && step.status === "running") onStep?.({ ...step, status: "failed" });
  }
}
