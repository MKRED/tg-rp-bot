import type { ToolCall } from "../../llm/types.js";
import logger from "../../logger.js";
import { proposePatch } from "./patch-proposals.js";
import { STALE_CARDS_RESULT, type CoauthorCardData } from "./prompt.js";
import { proposeEdit } from "./proposals.js";
import type { CoauthorState } from "./state.js";
import { APPLY_PATCH_TOOL_NAME, GET_CARDS_TOOL_NAME, parseEditBlockArguments } from "./tools.js";

export interface LocalToolOutcome {
  content: string;
  /** Сколько правок блоков создал вызов — для бюджета правок хода. */
  edits: number;
}

/** Ошибка исчерпанного бюджета правок: модель должна закончить ход и сказать, что осталось. */
export function editLimitError(maxEdits: number): string {
  return JSON.stringify({
    error:
      `the block edit limit for this turn is used up (${maxEdits}). Stop editing: tell the user what you ` +
      "changed and what is left to do — they can ask you to continue.",
  });
}

/** get_cards, edit_block и apply_patch — без внешних вызовов. */
export function runLocalTool(
  call: ToolCall,
  state: CoauthorState,
  cards: CoauthorCardData[],
  editsLeft: number,
  maxEdits: number,
): LocalToolOutcome {
  if (call.function.name === GET_CARDS_TOOL_NAME) {
    // Снимок в начале промпта пересобирается на каждый запрос (см. buildCoauthorInput) и уже
    // актуален — копии в истории только раздували бы её.
    return { content: STALE_CARDS_RESULT, edits: 0 };
  }
  if (editsLeft <= 0) return { content: editLimitError(maxEdits), edits: 0 };

  if (call.function.name === APPLY_PATCH_TOOL_NAME) {
    const outcome = proposePatch(state, cards, call.function.arguments, editsLeft);
    if (outcome.proposals.length === 0) {
      logger.warn({ inputLength: call.function.arguments.length, result: outcome.content.slice(0, 300) }, "Coauthor turn: apply_patch отклонён");
    }
    return { content: outcome.content, edits: outcome.proposals.length };
  }

  const args = parseEditBlockArguments(call.function.arguments);
  if (!args) {
    logger.warn({ rawLength: call.function.arguments.length }, "Coauthor turn: битые аргументы edit_block");
    return { content: JSON.stringify({ error: "invalid arguments: expected {card_id, block_id, content}" }), edits: 0 };
  }
  const outcome = proposeEdit(state, cards, args);
  return { content: outcome.content, edits: outcome.proposal ? 1 : 0 };
}
