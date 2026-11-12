import { describe, expect, it } from "vitest";
import { MalformedCompletionError, ResponseFailedError } from "../errors.js";
import { parseResponseBody, toResponsesResult } from "./result.js";
import type { RawResponse } from "./types.js";

const reasoning = { type: "reasoning", content: [{ type: "reasoning_text", text: "think" }] };
const call = (id: string, args: string) => ({ type: "function_call", status: "completed", call_id: id, name: "edit_block", arguments: args });

describe("toResponsesResult", () => {
  it("текст, рассуждение, вызовы и usage с кэшем", () => {
    const raw: RawResponse = {
      model: "deepseek-flash",
      status: "completed",
      output: [reasoning, { type: "message", content: [{ type: "output_text", text: "Hi " }, { type: "output_text", text: "there" }] }, call("c1", "{}")],
      usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120, input_tokens_details: { cached_tokens: 64 }, output_tokens_details: { reasoning_tokens: 5 } },
    };
    expect(toResponsesResult("deepseek", raw)).toEqual({
      content: "Hi there",
      model: "deepseek-flash",
      usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120, cachedTokens: 64, reasoningTokens: 5 },
      toolCalls: [{ id: "c1", type: "function", function: { name: "edit_block", arguments: "{}" } }],
      reasoningContent: "think",
    });
  });

  it("обрыв по лимиту: вызовы остаются (последний — с неполными аргументами), причина обрыва указана", () => {
    const raw: RawResponse = {
      model: "m",
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
      output: [call("c1", "{}"), call("c2", "{\"card_id\": 1, \"content\": \"Sto")],
    };
    const result = toResponsesResult("deepseek", raw);
    expect(result.toolCalls?.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(result.incompleteReason).toBe("max_output_tokens");
  });

  it("обрыв на рассуждении — ни текста, ни вызовов", () => {
    const result = toResponsesResult("deepseek", { model: "m", status: "incomplete", output: [reasoning] });
    expect(result).toMatchObject({ content: "", incompleteReason: "unknown" });
    expect(result.toolCalls).toBeUndefined();
  });

  it("status failed — ResponseFailedError", () => {
    expect(() => toResponsesResult("deepseek", { model: "m", status: "failed", output: [], error: { message: "boom" } }))
      .toThrow(ResponseFailedError);
  });
});

describe("parseResponseBody", () => {
  it("не JSON или нет output — MalformedCompletionError", () => {
    expect(() => parseResponseBody("deepseek", "\n\n")).toThrow(MalformedCompletionError);
    expect(() => parseResponseBody("deepseek", "{\"choices\":[]}")).toThrow(MalformedCompletionError);
    expect(parseResponseBody("deepseek", "{\"model\":\"m\",\"status\":\"completed\",\"output\":[]}").output).toEqual([]);
  });
});
