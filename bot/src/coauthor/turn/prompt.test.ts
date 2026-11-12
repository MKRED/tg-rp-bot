import { DEFAULT_COAUTHOR_SYSTEM_PROMPT } from "@tg-rp-bot/shared";
import { describe, expect, it } from "vitest";
import { buildSystemPrompt, cardsSnapshot, type CoauthorCardData } from "./prompt.js";

const cards: CoauthorCardData[] = [
  { id: 1, name: "Elena", brief: "Harbor master", images: [], blocks: [{ id: "fears", title: "Fears", format: "- ...", content: "" }] },
];

const limits = { maxRounds: 8, maxEdits: 5, maxQuestions: 2 };

describe("buildSystemPrompt", () => {
  it("пустой свой промпт — стандартный, протокол и лимиты дописываются всегда", () => {
    expect(buildSystemPrompt("  ", limits)).toContain(DEFAULT_COAUTHOR_SYSTEM_PROMPT);
    const custom = buildSystemPrompt("Write in Russian.", limits);
    expect(custom.startsWith("Write in Russian.")).toBe(true);
    expect(custom).toContain("apply_patch");
    expect(custom).toContain("up to 5 block edits");
  });
});

describe("cardsSnapshot", () => {
  it("показывает модели её ожидающую правку блока", () => {
    const json = JSON.parse(
      cardsSnapshot(cards, [{ id: "p1", cardId: 1, blockId: "fears", content: "Storms", baseContent: "", status: "pending" }]),
    );
    expect(json.cards[0].blocks[0]).toMatchObject({ block_id: "fears", path: "cards/1/fears.md", content: "", pending_proposal: "Storms" });
  });
});

describe("limitsPrompt через buildSystemPrompt", () => {
  it("вопросы выключены (maxQuestions 0) — про ask_user в лимитах ни слова", () => {
    expect(buildSystemPrompt("", { maxRounds: 8, maxEdits: 5, maxQuestions: 0 })).not.toContain("ask_user pauses");
    expect(buildSystemPrompt("", { maxRounds: 8, maxEdits: 5, maxQuestions: 2 })).toContain("up to 2 ask_user pauses");
  });
});
