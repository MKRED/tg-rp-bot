import type { StoredMessage } from "./state.js";
import { APPLY_PATCH_TOOL_NAME, EDIT_BLOCK_TOOL_NAME } from "./tools.js";

/**
 * Бюджеты хода считаются по самой истории, а не счётчиками в памяти: ход может прерваться паузой на
 * вопросы и продолжиться другим HTTP-запросом, и счёт должен пережить это.
 */

/** Сообщения текущего хода — после последнего сообщения пользователя. */
function currentTurn(messages: StoredMessage[]): StoredMessage[] {
  let start = messages.length;
  while (start > 0 && messages[start - 1]!.role !== "user") start--;
  return messages.slice(start);
}

/** Сколько раз в текущем ходе вызывался инструмент. */
export function callsInTurn(messages: StoredMessage[], name: string): number {
  let count = 0;
  for (const m of currentTurn(messages)) {
    if ("toolCalls" in m) count += m.toolCalls.filter((c) => c.function.name === name).length;
  }
  return count;
}

/** Сколько правок блоков результат вызова создал: edit_block — proposal_id, apply_patch — proposals[]. */
export function editsInResult(content: string): number {
  try {
    const parsed = JSON.parse(content) as { proposal_id?: unknown; proposals?: unknown };
    if (Array.isArray(parsed.proposals)) return parsed.proposals.length;
    return typeof parsed.proposal_id === "string" ? 1 : 0;
  } catch {
    return 0;
  }
}

/**
 * Удачные правки блоков в текущем ходе. Неудачные попытки (ошибка в результате) не в счёт: иначе один
 * битый патч съел бы бюджет, заданный пользователем, — от зацикливания на ошибках защищает лимит раундов.
 */
export function editsInTurn(messages: StoredMessage[]): number {
  const turn = currentTurn(messages);
  const editCalls = new Set<string>();
  for (const m of turn) {
    if (!("toolCalls" in m)) continue;
    for (const c of m.toolCalls) {
      if (c.function.name === EDIT_BLOCK_TOOL_NAME || c.function.name === APPLY_PATCH_TOOL_NAME) editCalls.add(c.id);
    }
  }
  let count = 0;
  for (const m of turn) if (m.role === "tool" && editCalls.has(m.toolCallId)) count += editsInResult(m.content);
  return count;
}

/**
 * Дописывает остаток бюджета в результат вызова (если это JSON-объект): модель видит его на каждом шаге и
 * заканчивает ход сама, а не узнаёт о лимите, когда инструменты молча пропали.
 */
export function withBudget(content: string, budget: { edits_left: number; rounds_left: number }): string {
  try {
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return content;
    return JSON.stringify({ ...parsed, ...budget });
  } catch {
    return content;
  }
}
