import { DEFAULT_COAUTHOR_SYSTEM_PROMPT } from "@tg-rp-bot/shared";
import { describe, expect, it } from "vitest";
import { buildCoauthorMessages, buildSystemPrompt, cardsSnapshot, TOOL_CALL_REASONING_STUB, type CoauthorCardData } from "./prompt.js";
import type { StoredMessage } from "./state.js";

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

describe("buildCoauthorMessages", () => {
  it("начинается не с assistant, карточки — результат get_cards, review — префиксом к user", () => {
    const history: StoredMessage[] = [
      { role: "user", content: "Fill Mira's fears", review: "accepted Elena → Fears" },
      {
        role: "assistant",
        content: null,
        toolCalls: [{ id: "c1", type: "function", function: { name: "edit_block", arguments: "{}" } }],
      },
      { role: "tool", toolCallId: "c1", content: "{}" },
    ];
    const messages = buildCoauthorMessages("", cards, [], history, 10_000);
    expect(messages.map((m) => m.role)).toEqual(["system", "user", "assistant", "tool", "assistant", "user", "assistant", "tool"]);
    expect(JSON.parse((messages[3] as { content: string }).content).cards[0].card_id).toBe(1);
    expect((messages[5] as { content: string }).content).toBe("[Review: accepted Elena → Fears]\n\nFill Mira's fears");
    expect(messages[6]).toMatchObject({ reasoning_content: TOOL_CALL_REASONING_STUB });
  });
});

describe("картинки-референсы", () => {
  const withRefs: CoauthorCardData[] = [
    { ...cards[0]!, images: ["data:image/jpeg;base64,AAA"] },
    { id: 2, name: "Mira", brief: "", images: [], blocks: [] },
  ];

  it("уходят в первое user-сообщение с подписью карточки", () => {
    const opening = buildCoauthorMessages("", withRefs, [], [], 1000, true)[1]!;
    expect(opening.role).toBe("user");
    const parts = opening.content as Array<{ type: string; text?: string; image_url?: { url: string } }>;
    expect(parts.map((p) => p.type)).toEqual(["text", "text", "image_url"]);
    expect(parts[1]!.text).toContain("Elena (card_id 1)");
    expect(parts[2]!.image_url!.url).toBe("data:image/jpeg;base64,AAA");
  });

  it("выключены — обычное текстовое сообщение", () => {
    expect(typeof buildCoauthorMessages("", withRefs, [], [], 1000, false)[1]!.content).toBe("string");
  });
});
