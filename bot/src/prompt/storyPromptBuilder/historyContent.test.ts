import { describe, expect, it } from "vitest";
import type { StoryMessage } from "@tg-rp-bot/shared";
import { storyHistoryContent, wrapDirective } from "./historyContent.js";

function msg(role: "user" | "assistant", kind: StoryMessage["kind"], content: string): StoryMessage {
  return { id: 1, parentId: null, role, kind, content, createdAt: "", siblingIndex: 0, siblingCount: 1, siblings: [1] };
}

describe("storyHistoryContent", () => {
  it("живая директива оборачивается в <directive>", () => {
    expect(storyHistoryContent(msg("user", "directive", "стража врывается"), true, "C")).toBe(
      "<directive>\nстража врывается\n</directive>",
    );
  });

  it("отыгранная директива нейтрализуется в маркер, без тега", () => {
    expect(storyHistoryContent(msg("user", "directive", "стража врывается"), false, "C")).toBe("C");
  });

  it("живой continue не оборачивается", () => {
    expect(storyHistoryContent(msg("user", "continue", "Continue the story."), true, "C")).toBe("Continue the story.");
  });

  it("бит идёт как есть, даже последним", () => {
    expect(storyHistoryContent(msg("assistant", "beat", "Бит."), true, "C")).toBe("Бит.");
    expect(storyHistoryContent(msg("assistant", "beat", "Бит."), false, "C")).toBe("Бит.");
  });

  it("wrapDirective сохраняет текст дословно (кавычки, переносы)", () => {
    expect(wrapDirective('Он говорит: "стой"\nи уходит')).toBe('<directive>\nОн говорит: "стой"\nи уходит\n</directive>');
  });
});
