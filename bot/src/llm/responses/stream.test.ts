import { describe, expect, it } from "vitest";
import { ResponseFailedError } from "../errors.js";
import { parseSseData, ResponsesStreamParser } from "./stream.js";

function setup() {
  const text: string[] = [];
  const calls: Array<{ id: string; name: string; arguments: string }> = [];
  const parser = new ResponsesStreamParser("deepseek", (t) => text.push(t), (c) => calls.push(c));
  return { parser, text, calls };
}

describe("parseSseData", () => {
  it("data-строки с пробелом и без; прочее — undefined", () => {
    expect(parseSseData('data: {"type":"x"}')).toEqual({ type: "x" });
    expect(parseSseData('data:{"type":"x"}')).toEqual({ type: "x" });
    expect(parseSseData("event: response.completed")).toBeUndefined();
    expect(parseSseData("data: [DONE]")).toBeUndefined();
    expect(parseSseData("data: {broken")).toBeUndefined();
    expect(parseSseData('data: {"no_type":1}')).toBeUndefined();
  });
});

describe("ResponsesStreamParser", () => {
  it("текст и вызов по дельтам, итог — из финального события", () => {
    const { parser, text, calls } = setup();
    parser.push({ type: "response.output_item.added", output_index: 0, item: { type: "reasoning" } });
    parser.push({ type: "response.reasoning_text.delta", output_index: 0, delta: "hmm" });
    parser.push({ type: "response.output_item.added", output_index: 1, item: { type: "function_call", call_id: "c1", name: "edit_block", arguments: "" } });
    parser.push({ type: "response.function_call_arguments.delta", output_index: 1, delta: '{"card_id"' });
    parser.push({ type: "response.function_call_arguments.delta", output_index: 1, delta: ": 1}" });
    parser.push({ type: "response.output_text.delta", output_index: 2, delta: "Done" });
    const final = { model: "m", status: "completed", output: [] };
    parser.push({ type: "response.completed", response: final });

    expect(text).toEqual(["Done"]);
    expect(calls.map((c) => c.arguments)).toEqual(["", '{"card_id"', '{"card_id": 1}']);
    expect(calls[0]).toMatchObject({ id: "c1", name: "edit_block" });
    expect(parser.result()).toBe(final);
  });

  it("response.incomplete тоже финал", () => {
    const { parser } = setup();
    parser.push({ type: "response.incomplete", response: { model: "m", status: "incomplete", output: [] } });
    expect(parser.result().status).toBe("incomplete");
  });

  it("провал и обрыв без финала — ResponseFailedError", () => {
    expect(() => setup().parser.push({ type: "response.failed", response: { model: "m", status: "failed", output: [], error: { message: "x" } } }))
      .toThrow(ResponseFailedError);
    expect(() => setup().parser.push({ type: "error", message: "overloaded" })).toThrow(ResponseFailedError);
    expect(() => setup().parser.result()).toThrow(ResponseFailedError);
  });
});
