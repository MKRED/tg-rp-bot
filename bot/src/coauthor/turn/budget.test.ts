import { describe, expect, it } from "vitest";
import { callsInTurn, editsInTurn, withBudget } from "./budget.js";
import type { StoredMessage } from "./state.js";

const call = (id: string, name: string, type: "function" | "custom" = "function") => ({ id, type, function: { name, arguments: "" } });

describe("бюджет хода", () => {
  const messages: StoredMessage[] = [
    { role: "user", content: "old" },
    { role: "assistant", content: null, toolCalls: [call("old", "edit_block")] },
    { role: "tool", toolCallId: "old", content: '{"ok":true,"proposal_id":"p1"}' },
    { role: "user", content: "now" },
    { role: "assistant", content: null, toolCalls: [call("e1", "edit_block"), call("p1", "apply_patch", "custom"), call("e2", "edit_block")] },
    { role: "tool", toolCallId: "e1", content: '{"ok":true,"proposal_id":"p2"}' },
    { role: "tool", toolCallId: "p1", content: '{"ok":true,"proposals":[{"proposal_id":"p3"},{"proposal_id":"p4"}]}' },
    { role: "tool", toolCallId: "e2", content: '{"error":"unknown card_id"}' },
  ];

  it("удачные правки текущего хода: edit_block — одна, патч — по блоку; ошибки и прошлые ходы не в счёт", () => {
    expect(editsInTurn(messages)).toBe(3);
    expect(callsInTurn(messages, "edit_block")).toBe(2);
  });

  it("остаток дописывается только в JSON-объект", () => {
    expect(JSON.parse(withBudget('{"ok":true}', { edits_left: 2, rounds_left: 5 }))).toEqual({ ok: true, edits_left: 2, rounds_left: 5 });
    expect(withBudget("plain", { edits_left: 2, rounds_left: 5 })).toBe("plain");
  });
});
