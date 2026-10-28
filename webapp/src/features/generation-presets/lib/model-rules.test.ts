import { describe, expect, it } from "vitest";
import { samplingHint, samplingRules } from "./model-rules";

describe("samplingRules", () => {
  it("температура действует только без рассуждения", () => {
    for (const model of ["deepseek-flash", "deepseek-v4-pro", "other", null]) {
      expect(samplingRules(model, false).temperature.applies).toBe(true);
      expect(samplingRules(model, true).temperature.applies).toBe(false);
    }
  });

  it("deepseek-flash: Top P только с рассуждением, от 0.95", () => {
    expect(samplingRules("deepseek-flash", false).topP).toEqual({ applies: false, min: 0 });
    expect(samplingRules("deepseek-flash", true).topP).toEqual({ applies: true, min: 0.95 });
  });

  it("deepseek-v4-pro: Top P только без рассуждения", () => {
    expect(samplingRules("deepseek-v4-pro", false).topP).toEqual({ applies: true, min: 0 });
    expect(samplingRules("deepseek-v4-pro", true).topP).toEqual({ applies: false, min: 0 });
  });

  it("модель не выбрана — правила модели по умолчанию (deepseek-flash)", () => {
    expect(samplingRules(null, true)).toEqual(samplingRules("deepseek-flash", true));
  });

  it("неизвестная модель — Top P показываем всегда", () => {
    expect(samplingRules("deepseek-next", false).topP.applies).toBe(true);
    expect(samplingRules("deepseek-next", true).topP.applies).toBe(true);
  });
});

describe("samplingHint", () => {
  it("объясняет, что не применяется", () => {
    expect(samplingHint("deepseek-v4-pro", true)).toMatch(/ни температуру, ни Top P/);
    expect(samplingHint("deepseek-flash", true)).toMatch(/Температуру/);
    expect(samplingHint("deepseek-flash", false)).toMatch(/Top P/);
  });

  it("всё действует — подсказки нет", () => {
    expect(samplingHint("deepseek-v4-pro", false)).toBeNull();
  });
});
