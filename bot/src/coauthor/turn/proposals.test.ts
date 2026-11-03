import { describe, expect, it } from "vitest";
import type { CoauthorCardData } from "./prompt.js";
import { dropOrphanedProposals, proposeEdit, reviewNote } from "./proposals.js";
import { emptyCoauthorState } from "./state.js";

const cards: CoauthorCardData[] = [
  {
    id: 1,
    name: "Elena",
    brief: "",
    blocks: [
      { id: "rel", title: "Relationships", format: "", content: "Sister: Mira" },
      { id: "fears", title: "Fears", format: "", content: "" },
    ],
  },
];

describe("proposeEdit", () => {
  it("создаёт ожидающую правку с текстом блока на момент предложения", () => {
    const state = emptyCoauthorState();
    const outcome = proposeEdit(state, cards, { cardId: 1, blockId: "rel", content: "Sister: Mira (estranged)" });
    expect(outcome.proposal).toMatchObject({ id: "p1", status: "pending", baseContent: "Sister: Mira" });
    expect(JSON.parse(outcome.content)).toMatchObject({ ok: true, proposal_id: "p1" });
    expect(state.nextProposalId).toBe(2);
  });

  it("новая правка того же блока заменяет ожидающую", () => {
    const state = emptyCoauthorState();
    proposeEdit(state, cards, { cardId: 1, blockId: "fears", content: "A" });
    proposeEdit(state, cards, { cardId: 1, blockId: "fears", content: "B" });
    expect(state.proposals.map((p) => p.status)).toEqual(["superseded", "pending"]);
  });

  it("неизвестные id, пустой и неизменённый текст — ошибка для модели", () => {
    const state = emptyCoauthorState();
    for (const args of [
      { cardId: 9, blockId: "rel", content: "x" },
      { cardId: 1, blockId: "nope", content: "x" },
      { cardId: 1, blockId: "rel", content: "" },
      { cardId: 1, blockId: "rel", content: "Sister: Mira" },
    ]) {
      const outcome = proposeEdit(state, cards, args);
      expect(outcome.proposal).toBeUndefined();
      expect(JSON.parse(outcome.content).error).toBeTypeOf("string");
    }
    expect(state.proposals).toHaveLength(0);
  });
});

describe("dropOrphanedProposals", () => {
  it("снимает ожидающие правки карточек, которых больше нет в чате", () => {
    const state = emptyCoauthorState();
    proposeEdit(state, cards, { cardId: 1, blockId: "fears", content: "A" });
    dropOrphanedProposals(state, []);
    expect(state.proposals[0]!.status).toBe("superseded");
  });
});

describe("reviewNote", () => {
  it("формулирует решение для модели", () => {
    expect(reviewNote(true, "Elena", "Fears")).toBe("accepted Elena → Fears");
    expect(reviewNote(false, "Elena", "Fears")).toBe("rejected Elena → Fears");
  });
});
