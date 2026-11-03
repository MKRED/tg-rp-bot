import type { CoauthorChat, CoauthorProposal } from "../types/coauthor";

/** Ожидающие решения правки чата. */
export function pendingProposals(chat: CoauthorChat): CoauthorProposal[] {
  return chat.proposals.filter((p) => p.status === "pending");
}

/** Ожидающая правка блока, если есть. */
export function proposalFor(chat: CoauthorChat, cardId: number, blockId: string): CoauthorProposal | undefined {
  return chat.proposals.find((p) => p.status === "pending" && p.cardId === cardId && p.blockId === blockId);
}

/**
 * Блок изменили после предложения (вручную в карточке или другой правкой) — принять её сервер не даст,
 * чтобы не затереть изменения. Видно сразу по тексту блока, без отдельного поля с сервера.
 */
export function isStale(chat: CoauthorChat, proposal: CoauthorProposal): boolean {
  const block = chat.cards.find((c) => c.id === proposal.cardId)?.blocks.find((b) => b.id === proposal.blockId);
  return block !== undefined && block.content !== proposal.baseContent;
}

/** Число ожидающих правок по карточкам — для счётчиков у переключателя персонажей. */
export function pendingCountByCard(chat: CoauthorChat): Map<number, number> {
  const counts = new Map<number, number>();
  for (const p of pendingProposals(chat)) counts.set(p.cardId, (counts.get(p.cardId) ?? 0) + 1);
  return counts;
}

/** «2 правки», «5 правок» — склонение по числу. */
export function editsLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const word = mod10 === 1 && mod100 !== 11 ? "правка" : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "правки" : "правок";
  return `${count} ${word}`;
}

/** «1 правка ждёт решения», «3 правки ждут решения». */
export function waitingLabel(count: number): string {
  const one = count % 10 === 1 && count % 100 !== 11;
  return `${editsLabel(count)} ${one ? "ждёт" : "ждут"} решения`;
}
