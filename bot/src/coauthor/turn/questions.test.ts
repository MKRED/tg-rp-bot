import { describe, expect, it } from "vitest";
import { askUserResult, resolvePendingQuestions } from "./questions.js";
import { emptyCoauthorState, type PendingQuestions } from "./state.js";

const pending: PendingQuestions = {
  toolCallId: "ask",
  questions: [{ question: "Who is 'her'?" }, { question: "Tone?" }],
  results: { edit: '{"ok":true}' },
};

describe("askUserResult", () => {
  it("пустой ответ — явный отказ, note — отдельным полем", () => {
    const json = JSON.parse(askUserResult(pending, { skipped: false, answers: ["Elena", " "], note: "short" })!);
    expect(json.answers[0].answer).toBe("Elena");
    expect(json.answers[1].answer).toBe("(user declined to answer)");
    expect(json.additional_user_instructions).toBe("short");
  });

  it("число ответов не совпало — null", () => {
    expect(askUserResult(pending, { skipped: false, answers: ["one"] })).toBeNull();
  });
});

describe("resolvePendingQuestions", () => {
  it("пишет результаты всех вызовов хода в порядке вызовов", () => {
    const state = emptyCoauthorState();
    state.messages.push({ role: "user", content: "go" });
    state.messages.push({
      role: "assistant",
      content: null,
      toolCalls: [
        { id: "ask", type: "function", function: { name: "ask_user", arguments: "{}" } },
        { id: "edit", type: "function", function: { name: "edit_block", arguments: "{}" } },
      ],
    });
    state.pending = pending;
    resolvePendingQuestions(state, '{"answers":[]}');
    expect(state.pending).toBeUndefined();
    expect(state.messages.slice(2)).toEqual([
      { role: "tool", toolCallId: "ask", content: '{"answers":[]}' },
      { role: "tool", toolCallId: "edit", content: '{"ok":true}' },
    ]);
  });
});
