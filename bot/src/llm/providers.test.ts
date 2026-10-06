import { describe, expect, it } from "vitest";
import { buildDeepSeekProvider, buildOpenRouterProvider, mapEffort } from "./providers.js";

describe("mapEffort", () => {
  it("minimal/low → low", () => {
    for (const e of ["minimal", "low"]) expect(mapEffort(e)).toBe("low");
  });

  it("medium/high/xhigh и пустое значение → high (как compat-маппинг DeepSeek)", () => {
    for (const e of ["medium", "high", "xhigh", undefined, null]) {
      expect(mapEffort(e)).toBe("high");
    }
  });

  it("max/ultra → max", () => {
    for (const e of ["max", "ultra"]) expect(mapEffort(e)).toBe("max");
  });
});

describe("buildDeepSeekProvider", () => {
  it("base URL, ключ/модель из аргументов, без app-заголовков", () => {
    const p = buildDeepSeekProvider("ds-key", "deepseek-flash");
    expect(p.name).toBe("deepseek");
    expect(p.baseUrl).toBe("https://api.deepseek.com");
    expect(p.apiKey).toBe("ds-key");
    expect(p.defaultModel).toBe("deepseek-flash");
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
      reasoningEffort: "ultra",
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
