import { describe, expect, it } from "vitest";
import { buildDeepSeekProvider } from "../providers.js";
import type { ToolDefinition } from "../types.js";
import { buildResponsesBody } from "./request.js";

const provider = buildDeepSeekProvider("sk", "deepseek-flash");
const tool: ToolDefinition = { type: "function", function: { name: "get_card", description: "d", parameters: { type: "object" } } };

describe("buildResponsesBody", () => {
  it("инструменты плоские, max_tokens → max_output_tokens, input — копия", () => {
    const input = [{ role: "user" as const, content: "hi" }];
    const body = buildResponsesBody(
      { userId: "u", input, tools: [tool], toolChoice: "auto", maxTokens: 16000, temperature: 0.7, topP: 0.9, requestReasoning: true },
      true,
      provider,
    );
    expect(body).toEqual({
      model: "deepseek-flash",
      input,
      stream: true,
      temperature: 0.7,
      max_output_tokens: 16000,
      top_p: 0.9,
      tools: [{ type: "function", name: "get_card", description: "d", parameters: { type: "object" } }],
      tool_choice: "auto",
      reasoning: { effort: "high" },
    });
    expect(body.input).not.toBe(input);
  });

  it("custom-инструмент уходит как есть, рядом с плоскими функциями", () => {
    const body = buildResponsesBody(
      { userId: "u", input: [], tools: [tool, { type: "custom", name: "apply_patch", description: "patch" }] },
      false,
      provider,
    );
    expect(body.tools).toEqual([
      { type: "function", name: "get_card", description: "d", parameters: { type: "object" } },
      { type: "custom", name: "apply_patch", description: "patch" },
    ]);
  });

  it("мышление выключено — effort none (thinking: disabled Responses игнорирует)", () => {
    expect(buildResponsesBody({ userId: "u", input: [] }, false, provider).reasoning).toEqual({ effort: "none" });
    expect(buildResponsesBody({ userId: "u", input: [], requestReasoning: true, reasoningEffort: "max" }, false, provider).reasoning)
      .toEqual({ effort: "max" });
  });

  it("принудительный вызов — { type, name } без обёртки function; модель пресета важнее дефолтной", () => {
    const body = buildResponsesBody(
      { userId: "u", input: [], model: "deepseek-v4-pro", toolChoice: { type: "function", function: { name: "get_card" } } },
      false,
      provider,
    );
    expect(body.tool_choice).toEqual({ type: "function", name: "get_card" });
    expect(body.model).toBe("deepseek-v4-pro");
  });
});
