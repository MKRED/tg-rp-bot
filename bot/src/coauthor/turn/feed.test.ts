import { describe, expect, it } from "vitest";
import { buildFeed } from "./feed.js";
import { emptyCoauthorState } from "./state.js";

describe("buildFeed", () => {
  it("собирает ленту: user без review, вопросы с ответами, правки хода одной плашкой", () => {
    const state = emptyCoauthorState();
    state.messages = [
      { role: "user", content: "Make them closer", review: "accepted X → Y" },
      {
        role: "assistant",
        content: null,
        toolCalls: [{ id: "a1", type: "function", function: { name: "ask_user", arguments: '{"questions":[{"question":"Who?"}]}' } }],
      },
      { role: "tool", toolCallId: "a1", content: '{"answers":[{"question":"Who?","answer":"(user declined to answer)"}]}' },
      {
        role: "assistant",
        content: null,
        toolCalls: [
          { id: "e1", type: "function", function: { name: "edit_block", arguments: "{}" } },
          { id: "e2", type: "function", function: { name: "edit_block", arguments: "{}" } },
        ],
      },
      { role: "tool", toolCallId: "e1", content: '{"ok":true,"proposal_id":"p1"}' },
      { role: "tool", toolCallId: "e2", content: '{"error":"unknown card_id"}' },
      {
        role: "assistant",
        content: null,
        toolCalls: [{ id: "e3", type: "function", function: { name: "edit_block", arguments: "{}" } }],
      },
      { role: "tool", toolCallId: "e3", content: '{"ok":true,"proposal_id":"p2"}' },
      { role: "assistant", content: "Done." },
    ];
    expect(buildFeed(state)).toEqual([
      { kind: "user", text: "Make them closer" },
      { kind: "questions", questions: [{ question: "Who?" }], answers: [""] },
      { kind: "edits", proposalIds: ["p1", "p2"] },
      { kind: "assistant", text: "Done." },
    ]);
  });

  it("ожидающие вопросы — answers: null", () => {
    const state = emptyCoauthorState();
    state.messages = [
      { role: "user", content: "go" },
      { role: "assistant", content: null, toolCalls: [{ id: "a1", type: "function", function: { name: "ask_user", arguments: "{}" } }] },
    ];
    state.pending = { toolCallId: "a1", questions: [{ question: "Tone?" }], results: {} };
    expect(buildFeed(state).at(-1)).toEqual({ kind: "questions", questions: [{ question: "Tone?" }], answers: null });
  });
});

describe("buildFeed: шаги хода", () => {
  it("шаги одного сообщения — один элемент перед правками, неудачные вызовы не показываются", () => {
    const state = emptyCoauthorState();
    const edit = (id: string, block: string) => ({
      id,
      type: "function" as const,
      function: { name: "edit_block", arguments: JSON.stringify({ card_id: 1, block_id: block, content: "x" }) },
    });
    state.messages = [
      { role: "user", content: "Go" },
      { role: "assistant", content: null, toolCalls: [{ id: "s1", type: "function", function: { name: "web_search", arguments: '{"query":"q"}' } }] },
      { role: "tool", toolCallId: "s1", content: '{"results":[]}' },
      { role: "assistant", content: null, toolCalls: [edit("e1", "fears"), edit("e2", "nope")] },
      { role: "tool", toolCallId: "e1", content: '{"ok":true,"proposal_id":"p1"}' },
      { role: "tool", toolCallId: "e2", content: '{"error":"no block"}' },
      { role: "assistant", content: "Done." },
      { role: "user", content: "Thanks" },
    ];
    expect(buildFeed(state)).toEqual([
      { kind: "user", text: "Go" },
      {
        kind: "steps",
        steps: [
          { id: "s1", status: "done", kind: "search", query: "q" },
          { id: "e1", status: "done", kind: "edit", cardId: 1, blockId: "fears" },
        ],
      },
      { kind: "edits", proposalIds: ["p1"] },
      { kind: "assistant", text: "Done." },
      { kind: "user", text: "Thanks" },
    ]);
  });
});
