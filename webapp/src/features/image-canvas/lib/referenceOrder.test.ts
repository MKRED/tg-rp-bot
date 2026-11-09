import { describe, expect, it } from "vitest";
import { identityOrder, isReordered, swapOrder } from "./referenceOrder";

describe("referenceOrder", () => {
  it("исходный порядок не считается перестановкой", () => {
    expect(identityOrder(3)).toEqual([0, 1, 2]);
    expect(isReordered([0, 1, 2])).toBe(false);
    expect(isReordered([1, 0, 2])).toBe(true);
  });

  it("«Левее / Правее» меняет с соседкой, за краем — null", () => {
    expect(swapOrder(3, 1, -1)).toEqual([1, 0, 2]);
    expect(swapOrder(3, 1, 1)).toEqual([0, 2, 1]);
    expect(swapOrder(3, 0, -1)).toBeNull();
    expect(swapOrder(3, 2, 1)).toBeNull();
  });
});
