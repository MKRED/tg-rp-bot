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
});
