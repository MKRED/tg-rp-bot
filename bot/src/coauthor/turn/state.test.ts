import { describe, expect, it } from "vitest";
import { emptyCoauthorState, parseCoauthorState, serializeCoauthorState } from "./state.js";

describe("serializeCoauthorState", () => {
  it("рассуждение сохраняется только у текущего хода — его требует продолжение после вопросов", () => {
    const state = emptyCoauthorState();
    const call = (id: string) => [{ id, type: "function" as const, function: { name: "list_cards", arguments: "{}" } }];
    state.messages.push(
      { role: "user", content: "a" },
      { role: "assistant", content: null, toolCalls: call("x"), reasoning: "old" },
      { role: "tool", toolCallId: "x", content: "{}" },
      { role: "user", content: "b" },
      { role: "assistant", content: null, toolCalls: call("y"), reasoning: "live" },
    );
    const saved = parseCoauthorState(serializeCoauthorState(state)).messages;
    expect(saved[1]).not.toHaveProperty("reasoning");
    expect(saved[4]).toMatchObject({ reasoning: "live" });
  });
});
