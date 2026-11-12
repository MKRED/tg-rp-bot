import { DEFAULT_COAUTHOR_SYSTEM_PROMPT } from "@tg-rp-bot/shared";
import { describe, expect, it } from "vitest";
import { buildSystemPrompt, cardsSnapshot, type CoauthorCardData } from "./prompt.js";

const cards: CoauthorCardData[] = [
  { id: 1, name: "Elena", brief: "Harbor master", images: [], blocks: [{ id: "fears", title: "Fears", format: "- ...", content: "" }] },
];

describe("buildSystemPrompt", () => {
  it("пустой свой промпт — стандартный, протокол дописывается всегда", () => {
    expect(buildSystemPrompt("  ")).toContain(DEFAULT_COAUTHOR_SYSTEM_PROMPT);
    const custom = buildSystemPrompt("Write in Russian.");
    expect(custom.startsWith("Write in Russian.")).toBe(true);
    expect(custom).toContain("edit_block");
  });
});

describe("cardsSnapshot", () => {
  it("показывает модели её ожидающую правку блока", () => {
    const json = JSON.parse(
      cardsSnapshot(cards, [{ id: "p1", cardId: 1, blockId: "fears", content: "Storms", baseContent: "", status: "pending" }]),
    );
    expect(json.cards[0].blocks[0]).toMatchObject({ block_id: "fears", content: "", pending_proposal: "Storms" });
  });
});
