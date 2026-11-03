import { describe, expect, it } from "vitest";
import type { StoredMessage } from "./state.js";
import { trimHistory } from "./trim.js";

const user = (content: string): StoredMessage => ({ role: "user", content });
const assistant = (content: string): StoredMessage => ({ role: "assistant", content });
const call = (id: string, args: string): StoredMessage => ({
  role: "assistant",
  content: null,
  toolCalls: [{ id, type: "function", function: { name: "edit_block", arguments: args } }],
});
const result = (id: string): StoredMessage => ({ role: "tool", toolCallId: id, content: "{}" });

describe("trimHistory", () => {
  it("оставляет всё, что влезает в бюджет", () => {
    const history = [user("a"), assistant("b"), user("c"), assistant("d")];
    expect(trimHistory(history, 1000)).toEqual(history);
  });

  it("режет старые ходы целиком, история начинается с user", () => {
    const long = "word ".repeat(200);
    const history = [user(long), call("c1", long), result("c1"), assistant(long), user("new"), assistant("ok")];
    const trimmed = trimHistory(history, 50);
    expect(trimmed).toEqual([user("new"), assistant("ok")]);
  });

  it("последний ход остаётся, даже если он больше бюджета", () => {
    const long = "word ".repeat(500);
    const history = [user("old"), assistant("x"), user(long), call("c1", long), result("c1")];
    const trimmed = trimHistory(history, 10);
    expect(trimmed[0]).toEqual(user(long));
    expect(trimmed).toHaveLength(3);
  });

  it("выбрасывает сообщения до первого user", () => {
    expect(trimHistory([assistant("orphan"), user("hi")], 1000)).toEqual([user("hi")]);
  });
});
