import { describe, expect, it } from "vitest";
import { proposePatch } from "./patch-proposals.js";
import type { CoauthorCardData } from "./prompt.js";
import { emptyCoauthorState } from "./state.js";

const cards: CoauthorCardData[] = [
  { id: 3, name: "Лира", brief: "", images: [], blocks: [{ id: "main", title: "Main", format: "", content: "- Глаза: зелёные\n- Волосы: рыжие" }] },
  { id: 4, name: "Ада", brief: "", images: [], blocks: [{ id: "main", title: "Main", format: "", content: "- Глаза: зелёные, как у сестры" }] },
];

const both =
  "*** Begin Patch\n*** Update File: cards/3/main.md\n@@\n-- Глаза: зелёные\n+- Глаза: серые\n" +
  "*** Update File: cards/4/main.md\n@@\n-- Глаза: зелёные, как у сестры\n+- Глаза: серые, как у сестры\n*** End Patch";

describe("proposePatch", () => {
  it("один патч — правка в каждой карточке, ответ модели со списком путей", () => {
    const state = emptyCoauthorState();
    const outcome = proposePatch(state, cards, both, 10);
    expect(state.proposals.map((p) => [p.cardId, p.content])).toEqual([
      [3, "- Глаза: серые\n- Волосы: рыжие"],
      [4, "- Глаза: серые, как у сестры"],
    ]);
    expect(JSON.parse(outcome.content)).toMatchObject({
      ok: true,
      proposals: [{ path: "cards/3/main.md", proposal_id: "p1" }, { path: "cards/4/main.md", proposal_id: "p2" }],
    });
  });

  it("атомарность: ошибка в одной секции — ничего не предлагается, ошибки названы по путям", () => {
    const state = emptyCoauthorState();
    const bad = both.replace("-- Глаза: зелёные, как у сестры", "-- Глаза: карие");
    const outcome = proposePatch(state, cards, bad, 10);
    expect(state.proposals).toEqual([]);
    expect(JSON.parse(outcome.content).error).toContain("cards/4/main.md: fragment not found");
  });

  it("база — ожидающая правка блока: «Переделать» продолжает её; старая становится superseded", () => {
    const state = emptyCoauthorState();
    proposePatch(state, cards, both, 10);
    const outcome = proposePatch(state, cards, "*** Begin Patch\n*** Update File: cards/3/main.md\n@@\n-- Глаза: серые\n+- Глаза: стальные\n*** End Patch", 10);
    expect(JSON.parse(outcome.content).ok).toBe(true);
    const lira = state.proposals.filter((p) => p.cardId === 3);
    expect(lira.map((p) => [p.status, p.content, p.baseContent])).toEqual([
      ["superseded", "- Глаза: серые\n- Волосы: рыжие", "- Глаза: зелёные\n- Волосы: рыжие"],
      ["pending", "- Глаза: стальные\n- Волосы: рыжие", "- Глаза: зелёные\n- Волосы: рыжие"],
    ]);
  });

  it("чужой путь, «без изменений» и нехватка бюджета правок — ошибки", () => {
    expect(JSON.parse(proposePatch(emptyCoauthorState(), cards, "*** Begin Patch\n*** Update File: cards/9/x.md\n-a\n+b", 10).content).error)
      .toContain("no such block");
    expect(JSON.parse(proposePatch(emptyCoauthorState(), cards, "*** Begin Patch\n*** Update File: cards/3/main.md\n-- Волосы: рыжие\n+- Волосы: рыжие", 10).content).error)
      .toContain("changes nothing");
    const state = emptyCoauthorState();
    expect(JSON.parse(proposePatch(state, cards, both, 1).content).error).toContain("only 1 block edits are left");
    expect(state.proposals).toEqual([]);
  });
});
