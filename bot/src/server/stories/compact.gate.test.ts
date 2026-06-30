import { describe, expect, it } from "vitest";
import { compactAvailable, compactUnavailableReason, resolveCompactFloor } from "./compact.gate.js";

describe("compactUnavailableReason / compactAvailable", () => {
  it("безграничный контекст → unlimited (недоступно)", () => {
    expect(compactUnavailableReason({ contextUnlimited: true, contextSize: 45000 })).toBe("unlimited");
    expect(compactAvailable({ contextUnlimited: true, contextSize: 45000 })).toBe(false);
  });

  it("нет контекста / null пресет → unlimited", () => {
    expect(compactUnavailableReason({ contextUnlimited: false, contextSize: null })).toBe("unlimited");
    expect(compactUnavailableReason(null)).toBe("unlimited");
  });

  it("слишком маленький контекст (< 4000) → too_small", () => {
    expect(compactUnavailableReason({ contextUnlimited: false, contextSize: 3999 })).toBe("too_small");
    expect(compactAvailable({ contextUnlimited: false, contextSize: 3999 })).toBe(false);
  });

  it("достаточный лимит → доступно (null)", () => {
    expect(compactUnavailableReason({ contextUnlimited: false, contextSize: 45000 })).toBe(null);
    expect(compactAvailable({ contextUnlimited: false, contextSize: 4000 })).toBe(true);
  });
});

describe("resolveCompactFloor", () => {
  it("0 (не задано) → дефолт round(contextSize*0.7)", () => {
    expect(resolveCompactFloor(0, 45000, 512)).toBe(Math.round(45000 * 0.7)); // 31500
  });

  it("заданное значение в границах возвращается как есть", () => {
    expect(resolveCompactFloor(35000, 45000, 512)).toBe(35000);
  });

  it("клампится снизу к COMPACT_FLOOR_MIN (1000)", () => {
    expect(resolveCompactFloor(200, 45000, 512)).toBe(1000);
  });

  it("клампится сверху к contextSize − outputReserve (строго < contextSize)", () => {
    // maxTokens=5000 → maxFloor=40000; floor 44000 → 40000.
    expect(resolveCompactFloor(44000, 45000, 5000)).toBe(40000);
    expect(resolveCompactFloor(44000, 45000, 5000)).toBeLessThan(45000);
  });

  it("maxTokens=null → резерв DEFAULT_OUTPUT_RESERVE (512)", () => {
    expect(resolveCompactFloor(50000, 45000, null)).toBe(45000 - 512);
  });
});
