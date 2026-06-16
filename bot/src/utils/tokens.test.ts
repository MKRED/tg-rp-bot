import { describe, expect, it } from "vitest";
import { countTokens } from "./tokens.js";

describe("countTokens", () => {
  it("возвращает 0 для пустой строки", () => {
    expect(countTokens("")).toBe(0);
  });

  it("считает реальные BPE-токены (не символы)", () => {
    // «hello world» у o200k_base — ровно 2 токена.
    expect(countTokens("hello world")).toBe(2);
    expect(countTokens("a")).toBe(1);
  });

  it("на кириллице даёт БОЛЬШЕ токенов, чем грубое len/4 (ключевая причина перехода)", () => {
    const ru = "Лиара медленно повернулась к тебе, её серебристые глаза блеснули в свете факелов.";
    const heuristic = Math.ceil(ru.length / 4);
    expect(countTokens(ru)).toBeGreaterThan(heuristic);
  });
});
