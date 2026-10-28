import { describe, expect, it } from "vitest";
import { buildDeepSeekProvider, mapEffort } from "./providers.js";

describe("mapEffort", () => {
  it("low/high/max проходят как есть", () => {
    for (const e of ["low", "high", "max"] as const) expect(mapEffort(e)).toBe(e);
  });

  it("неизвестное и пустое значение → high (дефолт API)", () => {
    for (const e of ["medium", "ultra", "", undefined, null]) expect(mapEffort(e)).toBe("high");
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
      reasoningEffort: "max",
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

