import { describe, expect, it } from "vitest";
import { swipeDirection } from "./swipe";

describe("swipeDirection", () => {
  it("палец влево — следующая, вправо — предыдущая", () => {
    expect(swipeDirection(-80, 5)).toBe(1);
    expect(swipeDirection(80, -5)).toBe(-1);
  });

  it("короткий или вертикальный жест — не свайп", () => {
    expect(swipeDirection(30, 0)).toBeNull();
    expect(swipeDirection(80, 120)).toBeNull();
  });
});
