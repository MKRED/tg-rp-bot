import { describe, expect, it } from "vitest";
import type { ResponsesInputItem } from "../../llm/responses/types.js";
import { buildCoauthorInput } from "./input.js";
import type { CoauthorCardData } from "./prompt.js";
import type { StoredMessage } from "./state.js";

const cards: CoauthorCardData[] = [
  { id: 1, name: "Elena", brief: "Harbor master", images: [], blocks: [{ id: "fears", title: "Fears", format: "- ...", content: "" }] },
];

/** Короткая подпись элемента: роль сообщения или тип элемента протокола. */
const kind = (item: ResponsesInputItem) => ("role" in item ? item.role : item.type);

/** Каждый function_call_output стоит после своего function_call — иначе DeepSeek отвечает 400. */
function expectPaired(input: ResponsesInputItem[]) {
  const seen = new Set<string>();
  for (const item of input) {
    if ("type" in item && item.type === "function_call") seen.add(item.call_id);
    if ("type" in item && item.type === "function_call_output") expect(seen.has(item.call_id)).toBe(true);
  }
}

describe("buildCoauthorInput", () => {
  it("начинается с system/user, карточки — результат get_cards, review — префиксом к user", () => {
    const history: StoredMessage[] = [
      { role: "user", content: "Fill Mira's fears", review: "accepted Elena → Fears" },
      { role: "assistant", content: null, toolCalls: [{ id: "c1", type: "function", function: { name: "edit_block", arguments: "{}" } }] },
      { role: "tool", toolCallId: "c1", content: "{\"ok\":true}" },
      { role: "assistant", content: "Proposed." },
    ];
    const input = buildCoauthorInput({ customPrompt: "", cards, proposals: [], history, historyTokenBudget: 10_000, limits: { maxRounds: 8, maxEdits: 24, maxQuestions: 2 } });
    expect(input.map(kind)).toEqual([
      "system", "user", "function_call", "function_call_output", "assistant",
      "user", "function_call", "function_call_output", "assistant",
    ]);
    const snapshot = input[3] as { output: string };
    expect(JSON.parse(snapshot.output).cards[0].card_id).toBe(1);
    expect(input[5]).toEqual({ role: "user", content: "[Review: accepted Elena → Fears]\n\nFill Mira's fears" });
    expect(input[6]).toEqual({ type: "function_call", call_id: "c1", name: "edit_block", arguments: "{}" });
    expectPaired(input);
  });

  it("вызов с текстом и живым рассуждением: reasoning → текст → вызовы; без рассуждения — без элемента", () => {
    const history: StoredMessage[] = [
      { role: "user", content: "Go" },
      {
        role: "assistant",
        content: "Let me check.",
        reasoning: "think",
        toolCalls: [
          { id: "a", type: "function", function: { name: "get_cards", arguments: "{}" } },
          { id: "b", type: "function", function: { name: "edit_block", arguments: "{}" } },
        ],
      },
      { role: "tool", toolCallId: "a", content: "{}" },
      { role: "tool", toolCallId: "b", content: "{}" },
      { role: "assistant", content: null, toolCalls: [{ id: "c", type: "function", function: { name: "get_cards", arguments: "{}" } }] },
      { role: "tool", toolCallId: "c", content: "{}" },
    ];
    const tail = buildCoauthorInput({ customPrompt: "", cards, proposals: [], history, historyTokenBudget: 10_000, limits: { maxRounds: 8, maxEdits: 24, maxQuestions: 2 } }).slice(6);
    expect(tail.map(kind)).toEqual([
      "reasoning", "assistant", "function_call", "function_call", "function_call_output", "function_call_output",
      "function_call", "function_call_output",
    ]);
    expect(tail[0]).toEqual({ type: "reasoning", summary: [], content: [{ type: "reasoning_text", text: "think" }] });
    expectPaired(tail);
  });
});

describe("картинки-референсы", () => {
  const withRefs: CoauthorCardData[] = [
    { ...cards[0]!, images: ["data:image/jpeg;base64,AAA"] },
    { id: 2, name: "Mira", brief: "", images: [], blocks: [] },
  ];

  it("уходят в первое user-сообщение с подписью карточки, image_url — строкой", () => {
    const opening = buildCoauthorInput({ customPrompt: "", cards: withRefs, proposals: [], history: [], historyTokenBudget: 1000, limits: { maxRounds: 8, maxEdits: 24, maxQuestions: 2 }, withImages: true })[1]!;
    expect(opening).toMatchObject({ role: "user" });
    const parts = (opening as { content: Array<{ type: string; text?: string; image_url?: string }> }).content;
    expect(parts.map((p) => p.type)).toEqual(["input_text", "input_text", "input_image"]);
    expect(parts[1]!.text).toContain("Elena (card_id 1)");
    expect(parts[2]!.image_url).toBe("data:image/jpeg;base64,AAA");
  });

  it("выключены — обычное текстовое сообщение", () => {
    expect(typeof (buildCoauthorInput({ customPrompt: "", cards: withRefs, proposals: [], history: [], historyTokenBudget: 1000, limits: { maxRounds: 8, maxEdits: 24, maxQuestions: 2 } })[1] as { content: unknown }).content).toBe("string");
  });
});

describe("custom-вызов после паузы на вопросах", () => {
  it("результат apply_patch, дописанный при ответе на вопросы, уходит как custom_tool_call_output", async () => {
    const { resolvePendingQuestions } = await import("./questions.js");
    const { emptyCoauthorState } = await import("./state.js");
    const state = emptyCoauthorState();
    state.messages.push(
      { role: "user", content: "Go" },
      {
        role: "assistant",
        content: null,
        toolCalls: [
          { id: "a1", type: "function", function: { name: "ask_user", arguments: '{"questions":[{"question":"Tone?"}]}' } },
          { id: "p1", type: "custom", function: { name: "apply_patch", arguments: "*** Begin Patch" } },
        ],
      },
    );
    state.pending = { toolCallId: "a1", questions: [{ question: "Tone?" }], results: { p1: '{"ok":true,"proposals":[]}' } };
    resolvePendingQuestions(state, '{"answers":[]}');
    const input = buildCoauthorInput({ customPrompt: "", cards, proposals: [], history: state.messages, historyTokenBudget: 10_000, limits: { maxRounds: 8, maxEdits: 24, maxQuestions: 2 } });
    expect(input.slice(-4).map(kind)).toEqual(["function_call", "custom_tool_call", "function_call_output", "custom_tool_call_output"]);
    expect(input.at(-1)).toMatchObject({ call_id: "p1", output: '{"ok":true,"proposals":[]}' });
    expectPaired(input);
  });
});
