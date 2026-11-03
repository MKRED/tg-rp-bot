import { describe, expect, it } from "vitest";
import type { CoauthorChat } from "../types/coauthor";
import { editsLabel, isStale, pendingCountByCard } from "./proposals";

const chat = {
  cards: [{ id: 1, name: "Elena", blocks: [{ id: "rel", title: "Relationships", content: "edited by hand" }] }],
  proposals: [
    { id: "p1", cardId: 1, blockId: "rel", content: "new", baseContent: "old", status: "pending" },
    { id: "p2", cardId: 1, blockId: "rel", content: "x", baseContent: "edited by hand", status: "rejected" },
  ],
} as unknown as CoauthorChat;

describe("proposals", () => {
  it("правка устарела, если блок изменили после предложения", () => {
    expect(isStale(chat, chat.proposals[0]!)).toBe(true);
    expect(isStale(chat, chat.proposals[1]!)).toBe(false);
  });

  it("считает только ожидающие правки", () => {
    expect(pendingCountByCard(chat).get(1)).toBe(1);
  });

  it("склоняет «правка»", () => {
    expect([1, 2, 5, 11, 21, 22].map(editsLabel)).toEqual(["1 правка", "2 правки", "5 правок", "11 правок", "21 правка", "22 правки"]);
  });
});
