import { describe, expect, it } from "vitest";
import { clampSearchRounds, DEFAULT_SEARCH_ROUNDS, MAX_SEARCH_ROUNDS, MIN_SEARCH_ROUNDS } from "./searchSettings.js";

describe("clampSearchRounds", () => {
  it("пропускает значение в допустимом диапазоне", () => {
    expect(clampSearchRounds(5)).toBe(5);
  });

  it("подрезает снизу и сверху", () => {
    expect(clampSearchRounds(0)).toBe(MIN_SEARCH_ROUNDS);
    expect(clampSearchRounds(-3)).toBe(MIN_SEARCH_ROUNDS);
    expect(clampSearchRounds(100)).toBe(MAX_SEARCH_ROUNDS);
  });

  it("округляет дробные значения вниз", () => {
    expect(clampSearchRounds(4.9)).toBe(4);
  });

  it("дефолтит NaN/Infinity", () => {
    expect(clampSearchRounds(NaN)).toBe(DEFAULT_SEARCH_ROUNDS);
    expect(clampSearchRounds(Infinity)).toBe(DEFAULT_SEARCH_ROUNDS);
  });
});
