import { describe, expect, it } from "vitest";
import { clampEdgeMessages, clampMaxRequests, DEFAULT_DEBUG_SETTINGS } from "./debugSettings.js";

describe("clampMaxRequests", () => {
  it.each([
    [30, 30],
    [0, 1],
    [-5, 1],
    [500, 200],
    [7.9, 7],
    [NaN, DEFAULT_DEBUG_SETTINGS.maxRequests],
    [Infinity, DEFAULT_DEBUG_SETTINGS.maxRequests],
  ])("%s → %s", (n, expected) => expect(clampMaxRequests(n)).toBe(expected));
});

describe("clampEdgeMessages", () => {
  it.each([
    [3, 3],
    [0, 0],
    [-1, 0],
    [999, 200],
    [2.5, 2],
    [NaN, 0],
  ])("%s → %s", (n, expected) => expect(clampEdgeMessages(n)).toBe(expected));
});
