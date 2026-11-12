import type { CoauthorFeedItem, CoauthorStep } from "@tg-rp-bot/shared";
import { ASK_USER_DECLINED_ANSWER, parseAskUserArguments } from "../../cards/generation/ask-user-tool.js";
import type { CoauthorState } from "./state.js";
import { callSteps } from "./steps.js";
import { APPLY_PATCH_TOOL_NAME, ASK_USER_TOOL_NAME, EDIT_BLOCK_TOOL_NAME } from "./tools.js";

function parseJson(raw: string | undefined): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Лента чата для экрана из истории протокола: сообщения пользователя (без служебного [Review]),
 * текст ответов модели, вопросы ask_user с ответами и правки, предложенные за ход. Правки одного
 * хода подряд склеиваются в один элемент — на экране это одна плашка «N правок». Шаги одного сообщения
 * пользователя — один элемент на месте первого шага: хранить их отдельно не нужно, всё есть в вызовах.
 */
export function buildFeed(state: CoauthorState): CoauthorFeedItem[] {
  const results = new Map<string, string>();
  for (const m of state.messages) if (m.role === "tool") results.set(m.toolCallId, m.content);
  // На паузе ask_user результаты остальных вызовов раунда ещё не в истории.
  for (const [id, content] of Object.entries(state.pending?.results ?? {})) results.set(id, content);

  const feed: CoauthorFeedItem[] = [];
  const pushEdits = (ids: string[]) => {
    if (ids.length === 0) return;
    const last = feed.at(-1);
    if (last?.kind === "edits") last.proposalIds.push(...ids);
    else feed.push({ kind: "edits", proposalIds: ids });
  };

  let turnSteps: CoauthorStep[] | undefined;
  for (const m of state.messages) {
    if (m.role === "user") {
      feed.push({ kind: "user", text: m.content });
      turnSteps = undefined;
      continue;
    }
    if (m.role !== "assistant") continue;
    if (!("toolCalls" in m)) {
      if (m.content) feed.push({ kind: "assistant", text: m.content });
      continue;
    }
    const steps = m.toolCalls.flatMap((call) => {
      const raw = { id: call.id, name: call.function.name, arguments: call.function.arguments };
      return callSteps(raw, results.get(call.id) ?? "{}").filter((step) => step.status !== "failed");
    });
    if (steps.length > 0) {
      if (!turnSteps) {
        turnSteps = [];
        feed.push({ kind: "steps", steps: turnSteps });
      }
      turnSteps.push(...steps);
    }
    if (m.content?.trim()) feed.push({ kind: "assistant", text: m.content.trim() });

    const edits: string[] = [];
    for (const call of m.toolCalls) {
      if (call.function.name === EDIT_BLOCK_TOOL_NAME) {
        const id = parseJson(results.get(call.id))?.proposal_id;
        if (typeof id === "string") edits.push(id);
        continue;
      }
      if (call.function.name === APPLY_PATCH_TOOL_NAME) {
        const proposals = parseJson(results.get(call.id))?.proposals;
        if (!Array.isArray(proposals)) continue;
        for (const p of proposals as Array<{ proposal_id?: unknown }>) {
          if (typeof p.proposal_id === "string") edits.push(p.proposal_id);
        }
        continue;
      }
      if (call.function.name !== ASK_USER_TOOL_NAME) continue;
      const pending = state.pending?.toolCallId === call.id ? state.pending : undefined;
      const questions = pending?.questions ?? parseAskUserArguments(call.function.arguments);
      if (!questions) continue;
      if (pending) {
        feed.push({ kind: "questions", questions, answers: null });
        continue;
      }
      const result = parseJson(results.get(call.id));
      // Вызов, отклонённый ошибкой (второй ask_user за ход), вопросом на экране не был.
      if (!result || !Array.isArray(result.answers)) continue;
      // Маркер отказа — для модели; на экране неотвеченный вопрос — пустой ответ.
      const answers = (result.answers as Array<{ answer?: unknown }>).map((a) =>
        typeof a.answer === "string" && a.answer !== ASK_USER_DECLINED_ANSWER ? a.answer : "",
      );
      feed.push({ kind: "questions", questions, answers, ...(result.skipped === true && { skipped: true }) });
    }
    pushEdits(edits);
  }
  return feed;
}
