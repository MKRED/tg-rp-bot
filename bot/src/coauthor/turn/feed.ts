import type { CoauthorFeedItem } from "@tg-rp-bot/shared";
import { ASK_USER_DECLINED_ANSWER, parseAskUserArguments } from "../../cards/generation/ask-user-tool.js";
import type { CoauthorState } from "./state.js";
import { ASK_USER_TOOL_NAME, EDIT_BLOCK_TOOL_NAME } from "./tools.js";

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
 * хода подряд склеиваются в один элемент — на экране это одна плашка «N правок».
 */
export function buildFeed(state: CoauthorState): CoauthorFeedItem[] {
  const results = new Map<string, string>();
  for (const m of state.messages) if (m.role === "tool") results.set(m.toolCallId, m.content);

  const feed: CoauthorFeedItem[] = [];
  const pushEdits = (ids: string[]) => {
    if (ids.length === 0) return;
    const last = feed.at(-1);
    if (last?.kind === "edits") last.proposalIds.push(...ids);
    else feed.push({ kind: "edits", proposalIds: ids });
  };

  for (const m of state.messages) {
    if (m.role === "user") {
      feed.push({ kind: "user", text: m.content });
      continue;
    }
    if (m.role !== "assistant") continue;
    if (!("toolCalls" in m)) {
      if (m.content) feed.push({ kind: "assistant", text: m.content });
      continue;
    }
    if (m.content?.trim()) feed.push({ kind: "assistant", text: m.content.trim() });

    const edits: string[] = [];
    for (const call of m.toolCalls) {
      if (call.function.name === EDIT_BLOCK_TOOL_NAME) {
        const id = parseJson(results.get(call.id))?.proposal_id;
        if (typeof id === "string") edits.push(id);
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
