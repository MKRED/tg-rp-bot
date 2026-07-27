import { describe, expect, it } from "vitest";
import { buildDeepSeekProvider, buildOpenRouterProvider, mapEffort } from "./providers.js";

describe("mapEffort", () => {
  it("xhigh → max", () => {
    expect(mapEffort("xhigh")).toBe("max");
  });

  it("остальные уровни и пустое значение → high", () => {
    for (const e of ["minimal", "low", "medium", "high", undefined, null]) {
      expect(mapEffort(e)).toBe("high");
    }
  });
});

describe("buildDeepSeekProvider", () => {
  it("base URL, ключ/модель из аргументов, без app-заголовков", () => {
    const p = buildDeepSeekProvider("ds-key", "deepseek-v4-flash");
    expect(p.name).toBe("deepseek");
    expect(p.baseUrl).toBe("https://api.deepseek.com");
    expect(p.apiKey).toBe("ds-key");
    expect(p.defaultModel).toBe("deepseek-v4-flash");
    expect(p.appHeaders).toBeUndefined();
  });

  it("выключенное мышление → thinking disabled", () => {
    const body = buildDeepSeekProvider("k", "m").reasoningBody({
      messages: [],
      userId: 1,
      requestReasoning: false,
    });
    expect(body).toEqual({ thinking: { type: "disabled" } });
  });

  it("включённое мышление → thinking enabled + смаппленный effort", () => {
    const body = buildDeepSeekProvider("k", "m").reasoningBody({
      messages: [],
      userId: 1,
      requestReasoning: true,
      reasoningEffort: "xhigh",
    });
    expect(body).toEqual({ thinking: { type: "enabled" }, reasoning_effort: "max" });
  });

  it("включённое мышление без уровня → high", () => {
    const body = buildDeepSeekProvider("k", "m").reasoningBody({
      messages: [],
      userId: 1,
      requestReasoning: true,
    });
    expect(body).toEqual({ thinking: { type: "enabled" }, reasoning_effort: "high" });
  });
});

describe("buildOpenRouterProvider", () => {
  it("base URL, app-заголовки, reasoning не добавляется — тело OpenRouter не трогаем", () => {
    const p = buildOpenRouterProvider("or-key", "openai/gpt-4o-mini");
    expect(p.name).toBe("openrouter");
    expect(p.baseUrl).toBe("https://openrouter.ai/api/v1");
    expect(p.apiKey).toBe("or-key");
    expect(p.appHeaders).toBeDefined();
    expect(
      p.reasoningBody({ messages: [], userId: 1, requestReasoning: true, reasoningEffort: "xhigh" }),
    ).toEqual({});
  });
});
