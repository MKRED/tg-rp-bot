import { describe, expect, it } from "vitest";
import type { ResponsesInputItem } from "../../llm/responses/types.js";
import { renderCard } from "./card-context/index.js";
import { buildCoauthorInput, type CoauthorInputParams } from "./input.js";
import type { CoauthorCardData } from "./prompt.js";
import type { StoredMessage } from "./state.js";

const cards: CoauthorCardData[] = [
  { id: 1, name: "Elena", brief: "Harbor master", images: ["data:image/jpeg;base64,AAA"], blocks: [{ id: "fears", title: "Fears", format: "- ...", content: "" }] },
];

const build = (history: StoredMessage[], over: Partial<CoauthorInputParams> = {}) =>
  buildCoauthorInput({ customPrompt: "", cards, proposals: [], history, historyTokenBudget: 10_000, limits: { maxRounds: 8, maxEdits: 24, maxQuestions: 2 }, ...over });

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

const readCall = (id: string): StoredMessage => ({
  role: "assistant",
  content: null,
  toolCalls: [{ id, type: "function", function: { name: "get_card", arguments: '{"card_id":1}' } }],
});

describe("buildCoauthorInput", () => {
  it("сразу после system — история с user, без служебных реплик; review — префиксом к user", () => {
    const history: StoredMessage[] = [
      { role: "user", content: "Fill Mira's fears", review: "accepted Elena → Fears" },
      { role: "assistant", content: null, toolCalls: [{ id: "c1", type: "function", function: { name: "edit_block", arguments: "{}" } }] },
      { role: "tool", toolCallId: "c1", content: "{\"ok\":true}" },
      { role: "assistant", content: "Proposed." },
    ];
    const input = build(history);
    expect(input.map(kind)).toEqual(["system", "user", "function_call", "function_call_output", "assistant"]);
    expect(input[1]).toEqual({ role: "user", content: "[Review: accepted Elena → Fears]\n\nFill Mira's fears" });
    expectPaired(input);
  });

  it("вызов с текстом и живым рассуждением: reasoning → текст → вызовы", () => {
    const history: StoredMessage[] = [
      { role: "user", content: "Go" },
      {
        role: "assistant",
        content: "Let me check.",
        reasoning: "think",
        toolCalls: [
          { id: "a", type: "function", function: { name: "list_cards", arguments: "{}" } },
          { id: "b", type: "function", function: { name: "edit_block", arguments: "{}" } },
        ],
      },
      { role: "tool", toolCallId: "a", content: "{}" },
      { role: "tool", toolCallId: "b", content: "{}" },
    ];
    const tail = build(history).slice(2);
    expect(tail.map(kind)).toEqual(["reasoning", "assistant", "function_call", "function_call", "function_call_output", "function_call_output"]);
    expect(tail[0]).toEqual({ type: "reasoning", summary: [], content: [{ type: "reasoning_text", text: "think" }] });
    expectPaired(tail);
  });
});

describe("результаты get_card", () => {
  const read: StoredMessage[] = [
    { role: "user", content: "Read Elena" },
    readCall("g1"),
    { role: "tool", toolCallId: "g1", content: renderCard(cards[0]!, []) },
    { role: "assistant", content: "Read." },
  ];
  const outputOf = (input: ResponsesInputItem[], id: string) =>
    (input.find((i) => "type" in i && i.type === "function_call_output" && i.call_id === id) as { output: unknown }).output;

  it("актуальный — сохранённый текст и картинки с подписью карточки, image_url строкой", () => {
    const output = outputOf(build(read, { withImages: true }), "g1") as Array<{ type: string; text?: string; image_url?: string }>;
    expect(output.map((p) => p.type)).toEqual(["input_text", "input_text", "input_image"]);
    expect(output[0]!.text).toBe(renderCard(cards[0]!, []));
    expect(output[1]!.text).toContain("Elena (card_id 1)");
    expect(output[2]!.image_url).toBe("data:image/jpeg;base64,AAA");
  });

  it("картинки выключены — только текст", () => {
    expect(outputOf(build(read), "g1")).toBe(renderCard(cards[0]!, []));
  });

  it("карточка изменилась после чтения — в прошлом ходе заглушка вместо текста", () => {
    const changed = [{ ...cards[0]!, blocks: [{ id: "fears", title: "Fears", format: "- ...", content: "Storms" }] }];
    const history = [...read, { role: "user" as const, content: "Next" }];
    expect(String(outputOf(build(history, { cards: changed }), "g1"))).toContain("Outdated");
  });

  it("старый get_cards из прежних чатов — заглушка про удалённый инструмент", () => {
    const history: StoredMessage[] = [
      { role: "user", content: "Go" },
      { role: "assistant", content: null, toolCalls: [{ id: "old", type: "function", function: { name: "get_cards", arguments: "{}" } }] },
      { role: "tool", toolCallId: "old", content: '{"note":"current"}' },
    ];
    expect(String(outputOf(build(history), "old"))).toContain("removed tool");
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
    const input = build(state.messages);
    expect(input.slice(-4).map(kind)).toEqual(["function_call", "custom_tool_call", "function_call_output", "custom_tool_call_output"]);
    expect(input.at(-1)).toMatchObject({ call_id: "p1", output: '{"ok":true,"proposals":[]}' });
    expectPaired(input);
  });
});
