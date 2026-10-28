import { describe, expect, it } from "vitest";
import { buildDeepSeekProvider, mapEffort } from "./providers.js";

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
  it("base URL, ключ/модель из аргументов", () => {
    const p = buildDeepSeekProvider("ds-key", "deepseek-flash");
    expect(p.name).toBe("deepseek");
    expect(p.baseUrl).toBe("https://api.deepseek.com");
    expect(p.apiKey).toBe("ds-key");
    expect(p.defaultModel).toBe("deepseek-flash");
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

