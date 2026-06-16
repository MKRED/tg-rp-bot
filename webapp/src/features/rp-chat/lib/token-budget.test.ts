import { describe, expect, it } from "vitest";
import { tokenBudget } from "./token-budget";

describe("tokenBudget", () => {
  it("трактует null-лимит как безграничный", () => {
    expect(tokenBudget(1000, null)).toEqual({ pct: 0, level: "ok", unlimited: true });
  });

  it("неположительный лимит — тоже безграничный", () => {
    expect(tokenBudget(50, 0)).toEqual({ pct: 0, level: "ok", unlimited: true });
  });

  it("считает процент и обрезает сверху до 100", () => {
    expect(tokenBudget(2000, 8000).pct).toBe(25);
    expect(tokenBudget(16000, 8000).pct).toBe(100); // переполнение не вылезает за 100
  });

  it("зелёная зона ниже порога 85%", () => {
    expect(tokenBudget(4000, 8000).level).toBe("ok");
  });

  it("жёлтая зона от 85% до лимита", () => {
    expect(tokenBudget(7000, 8000).level).toBe("warn"); // 87.5%
  });

  it("красная зона при достижении/превышении лимита", () => {
    expect(tokenBudget(8000, 8000).level).toBe("over");
    expect(tokenBudget(9000, 8000).level).toBe("over");
  });
});
