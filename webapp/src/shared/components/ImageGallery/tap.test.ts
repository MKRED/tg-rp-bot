import { describe, expect, it } from "vitest";
import { isTap } from "./tap";

describe("isTap", () => {
  it("короткое касание на месте — тап", () => {
    expect(isTap(2, 3, 120)).toBe(true);
  });

  it("протяжка или удержание — не тап", () => {
    expect(isTap(40, 0, 120)).toBe(false);
    expect(isTap(0, 0, 600)).toBe(false);
  });
});
