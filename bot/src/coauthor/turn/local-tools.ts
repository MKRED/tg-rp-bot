import type { ToolCall } from "../../llm/types.js";
import logger from "../../logger.js";
import { parseBlockPath, parsePatch } from "./apply-patch/index.js";
import { renderCard, renderCardList } from "./card-context/index.js";
import { proposePatch } from "./patch-proposals.js";
import type { CoauthorCardData } from "./prompt.js";
import { proposeEdit } from "./proposals.js";
import type { CoauthorState } from "./state.js";
import { APPLY_PATCH_TOOL_NAME, GET_CARD_TOOL_NAME, LIST_CARDS_TOOL_NAME, parseEditBlockArguments } from "./tools.js";

export interface LocalToolOutcome {
  content: string;
  /** Сколько правок блоков создал вызов — для бюджета правок хода. */
  edits: number;
}

export interface LocalToolContext {
  state: CoauthorState;
  cards: CoauthorCardData[];
  /** Карточки, актуальный текст которых модель уже видит (card-context/replay.ts) — их можно править. */
  loaded: Set<number>;
  editsLeft: number;
  maxEdits: number;
}

const error = (message: string): LocalToolOutcome => ({ content: JSON.stringify({ error: message }), edits: 0 });

/** Ошибка исчерпанного бюджета правок: модель должна закончить ход и сказать, что осталось. */
export function editLimitError(maxEdits: number): string {
  return JSON.stringify({
    error:
      `the block edit limit for this turn is used up (${maxEdits}). Stop editing: tell the user what you ` +
      "changed and what is left to do — they can ask you to continue.",
  });
}

/** list_cards, get_card, edit_block и apply_patch — без внешних вызовов. */
export function runLocalTool(call: ToolCall, ctx: LocalToolContext): LocalToolOutcome {
  const { state, cards, loaded, editsLeft, maxEdits } = ctx;
  if (call.function.name === LIST_CARDS_TOOL_NAME) return { content: renderCardList(cards, loaded), edits: 0 };
  if (call.function.name === GET_CARD_TOOL_NAME) {
    const cardId = parseCardId(call.function.arguments);
    const card = cards.find((c) => c.id === cardId);
    if (!card) return error(`unknown card_id ${cardId ?? "?"} — use card_id values from list_cards`);
    return { content: renderCard(card, state.proposals), edits: 0 };
  }
  if (editsLeft <= 0) return { content: editLimitError(maxEdits), edits: 0 };

  if (call.function.name === APPLY_PATCH_TOOL_NAME) {
    const unread = unreadPatchCards(call.function.arguments, cards, loaded);
    if (unread.length > 0) return error(notLoaded(unread));
    const outcome = proposePatch(state, cards, call.function.arguments, editsLeft);
    if (outcome.proposals.length === 0) {
      logger.warn({ inputLength: call.function.arguments.length, result: outcome.content.slice(0, 300) }, "Coauthor turn: apply_patch отклонён");
    }
    return { content: outcome.content, edits: outcome.proposals.length };
  }

  const args = parseEditBlockArguments(call.function.arguments);
  if (!args) {
    logger.warn({ rawLength: call.function.arguments.length }, "Coauthor turn: битые аргументы edit_block");
    return error("invalid arguments: expected {card_id, block_id, content}");
  }
  if (cards.some((c) => c.id === args.cardId) && !loaded.has(args.cardId)) return error(notLoaded([args.cardId]));
  const outcome = proposeEdit(state, cards, args);
  return { content: outcome.content, edits: outcome.proposal ? 1 : 0 };
}

/**
 * Правка вслепую — по тексту, которого модель не видела или который устарел, — испортила бы блок: патч лёг бы
 * не туда, edit_block затёр бы чужие изменения. Карточка, прочитанная в этом же раунде, тоже не в счёт —
 * результат чтения модель увидит только в следующем.
 */
function notLoaded(cardIds: number[]): string {
  const calls = cardIds.map((id) => `get_card(${id})`).join(", ");
  return `card ${cardIds.join(", ")} is not read or changed since you read it — call ${calls} first, then make this edit`;
}

/** Карточки патча, которые модель не прочитала. Битый патч — пусто: его ошибку объяснит proposePatch. */
function unreadPatchCards(input: string, cards: CoauthorCardData[], loaded: Set<number>): number[] {
  const parsed = parsePatch(input);
  if (!parsed.ok) return [];
  const ids = new Set<number>();
  for (const section of parsed.sections) {
    const cardId = parseBlockPath(section.path)?.cardId;
    if (cardId !== undefined && cards.some((c) => c.id === cardId) && !loaded.has(cardId)) ids.add(cardId);
  }
  return [...ids];
}

/** card_id из аргументов get_card; модель иногда шлёт его строкой — это тот же id. */
function parseCardId(raw: string): number | undefined {
  try {
    const { card_id } = JSON.parse(raw) as { card_id?: unknown };
    const id = typeof card_id === "string" && /^\d+$/.test(card_id) ? Number(card_id) : card_id;
    return typeof id === "number" && Number.isInteger(id) ? id : undefined;
  } catch {
    return undefined;
  }
}
