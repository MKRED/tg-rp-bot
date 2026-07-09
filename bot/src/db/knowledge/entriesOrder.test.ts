import { describe, expect, it } from "vitest";
import { isPermutationOf } from "./entriesOrder.js";

describe("isPermutationOf", () => {
  it("принимает ту же перестановку", () => {
    expect(isPermutationOf([3, 1, 2], [1, 2, 3])).toBe(true);
  });

  it("принимает совпадающий порядок", () => {
    expect(isPermutationOf([1, 2, 3], [1, 2, 3])).toBe(true);
  });

  it("два пустых массива — валидная (пустая) перестановка", () => {
    expect(isPermutationOf([], [])).toBe(true);
  });

  it("отвергает разную длину (пропущен id)", () => {
    expect(isPermutationOf([1, 2], [1, 2, 3])).toBe(false);
  });

  it("отвергает дубли при совпадающей длине", () => {
    expect(isPermutationOf([1, 1, 2], [1, 2, 3])).toBe(false);
  });

  it("отвергает чужой id (тот же размер, другой набор)", () => {
    expect(isPermutationOf([1, 2, 99], [1, 2, 3])).toBe(false);
  });

  it("отвергает непустой порядок для пустого набора", () => {
    expect(isPermutationOf([1], [])).toBe(false);
  });
});
