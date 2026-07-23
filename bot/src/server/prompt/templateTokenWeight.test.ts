import { describe, expect, it } from "vitest";
import { templateTokenWeight } from "./templateTokenWeight.js";

const fields = {
  systemPrompt: "hello world",
  auxiliarySystemPrompt: "hello world",
  postHistoryInstruction: "hello world",
};

describe("templateTokenWeight", () => {
  it("суммирует только enabled-компоненты из system/auxiliary/postHistory", () => {
    const promptOrder = [
      { id: "system", enabled: true },
      { id: "auxiliary", enabled: false },
      { id: "postHistory", enabled: true },
    ];
    // "hello world" у o200k_base — 2 токена (см. bot/src/utils/tokens.test.ts).
    expect(templateTokenWeight(fields, promptOrder)).toBe(4);
  });

  it("игнорирует компоненты, не принадлежащие шаблону (персонаж, персона, книга, история)", () => {
    const promptOrder = [
      { id: "characterDescription", enabled: true },
      { id: "userDescription", enabled: true },
      { id: "history", enabled: true },
    ];
    expect(templateTokenWeight(fields, promptOrder)).toBe(0);
  });

  it("пустой promptOrder → 0", () => {
    expect(templateTokenWeight(fields, [])).toBe(0);
  });

  it("все три компонента включены → сумма всех трёх", () => {
    const promptOrder = [
      { id: "system", enabled: true },
      { id: "auxiliary", enabled: true },
      { id: "postHistory", enabled: true },
    ];
    expect(templateTokenWeight(fields, promptOrder)).toBe(6);
  });
});
