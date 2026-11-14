import { DEFAULT_COAUTHOR_SYSTEM_PROMPT } from "@tg-rp-bot/shared";
import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./prompt.js";

const limits = { maxRounds: 8, maxEdits: 5, maxQuestions: 2 };

describe("buildSystemPrompt", () => {
  it("пустой свой промпт — стандартный, протокол и лимиты дописываются всегда", () => {
    expect(buildSystemPrompt("  ", limits)).toContain(DEFAULT_COAUTHOR_SYSTEM_PROMPT);
    const custom = buildSystemPrompt("Write in Russian.", limits);
    expect(custom.startsWith("Write in Russian.")).toBe(true);
    expect(custom).toContain("apply_patch");
    expect(custom).toContain("get_card(card_id)");
    // Механика и лимиты — всегда; правила поведения — только в редактируемой части, пользователь их меняет.
    expect(custom).toContain("a ceiling, not a target");
    expect(custom).not.toContain("explicitly allowed");
    expect(buildSystemPrompt("", limits)).toContain("Write only what the user explicitly allowed");
    expect(custom).toContain("up to 5 block edits");
  });
});
