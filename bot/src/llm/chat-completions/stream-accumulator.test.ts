import { describe, expect, it } from "vitest";
import { ToolCallAccumulator } from "./stream-accumulator.js";

describe("ToolCallAccumulator", () => {
  it("склеивает аргументы по index и отдаёт вызовы по порядку", () => {
    const acc = new ToolCallAccumulator();
    acc.add({ index: 1, id: "b", function: { name: "web_search", arguments: "" } });
    acc.add({ index: 0, id: "a", function: { name: "edit_block", arguments: '{"card_' } });
    acc.add({ index: 0, function: { arguments: 'id":1}' } });
    acc.add({ index: 1, function: { arguments: "{}" } });

    expect(acc.result()).toEqual([
      { id: "a", type: "function", function: { name: "edit_block", arguments: '{"card_id":1}' } },
      { id: "b", type: "function", function: { name: "web_search", arguments: "{}" } },
    ]);
  });

  it("add отдаёт вызов, только когда известны id и имя", () => {
    const acc = new ToolCallAccumulator();
    expect(acc.add({ index: 0, function: { arguments: "{" } })).toBeUndefined();
    expect(acc.add({ index: 0, id: "a", function: { name: "get_cards" } })).toEqual({ id: "a", name: "get_cards", arguments: "{" });
  });

  it("без дельт — undefined, а не пустой массив", () => {
    expect(new ToolCallAccumulator().result()).toBeUndefined();
  });
});
