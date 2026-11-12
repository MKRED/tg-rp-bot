import { describe, expect, it } from "vitest";
import { thinkingBody } from "./request.js";

describe("thinkingBody", () => {
  it("выключенное мышление → thinking disabled", () => {
    expect(thinkingBody({ messages: [], userId: "u", requestReasoning: false })).toEqual({ thinking: { type: "disabled" } });
  });

  it("включённое мышление → thinking enabled + смаппленный effort", () => {
    expect(thinkingBody({ messages: [], userId: "u", requestReasoning: true, reasoningEffort: "max" }))
      .toEqual({ thinking: { type: "enabled" }, reasoning_effort: "max" });
  });

  it("включённое мышление без уровня → high", () => {
    expect(thinkingBody({ messages: [], userId: "u", requestReasoning: true }))
      .toEqual({ thinking: { type: "enabled" }, reasoning_effort: "high" });
  });
});
