import type { CoauthorProposal } from "@tg-rp-bot/shared";
import type { CoauthorCardData } from "./prompt.js";
import type { CoauthorState } from "./state.js";
import type { EditBlockArguments } from "./tools.js";

/** Исход edit_block: content уходит модели результатом вызова. */
export interface ProposeOutcome {
  content: string;
  proposal?: CoauthorProposal;
}

const error = (message: string): ProposeOutcome => ({ content: JSON.stringify({ error: message }) });

/**
 * Записывает правку блока как предложение. Прошлое ожидающее предложение для того же блока
 * становится superseded: пользователь видит только последнюю версию, а модель — что её новая
 * правка заменила старую. Невалидные id и правка «без изменений» возвращаются модели ошибкой.
 * Меняет state на месте (вызывающий работает с копией на время хода).
 */
export function proposeEdit(state: CoauthorState, cards: CoauthorCardData[], args: EditBlockArguments): ProposeOutcome {
  const card = cards.find((c) => c.id === args.cardId);
  if (!card) return error(`unknown card_id ${args.cardId} — use card_id values from get_cards`);
  const block = card.blocks.find((b) => b.id === args.blockId);
  if (!block) {
    return error(`card ${args.cardId} has no block "${args.blockId}" — blocks cannot be created, use block_id values from get_cards`);
  }
  if (!args.content) return error("content is empty — blocks cannot be cleared");
  if (args.content === block.content) return error("content is identical to the current block — nothing to propose");

  for (const p of state.proposals) {
    if (p.status === "pending" && p.cardId === card.id && p.blockId === block.id) p.status = "superseded";
  }
  const proposal: CoauthorProposal = {
    id: `p${state.nextProposalId++}`,
    cardId: card.id,
    blockId: block.id,
    content: args.content,
    baseContent: block.content,
    status: "pending",
  };
  state.proposals.push(proposal);
  return { content: JSON.stringify({ ok: true, proposal_id: proposal.id, status: "waiting for user review" }), proposal };
}

/** Строка решения для модели: «accepted Elena Voss → Relationships». */
export function reviewNote(accepted: boolean, cardName: string, blockTitle: string): string {
  return `${accepted ? "accepted" : "rejected"} ${cardName} → ${blockTitle}`;
}

/**
 * Предложения, которые устарели без участия модели: карточку убрали из чата или удалили, блок
 * пропал из карточки. Они больше не могут быть приняты — снимаем их из ожидающих.
 */
export function dropOrphanedProposals(state: CoauthorState, cards: CoauthorCardData[]): void {
  for (const p of state.proposals) {
    if (p.status !== "pending") continue;
    const card = cards.find((c) => c.id === p.cardId);
    if (!card?.blocks.some((b) => b.id === p.blockId)) p.status = "superseded";
  }
}
