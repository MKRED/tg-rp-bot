import { describe, expect, it } from "vitest";
import { clampStoredCompactFloor, compactAvailable, compactUnavailableReason, resolveCompactFloor } from "./compact-gate.js";

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

describe("clampStoredCompactFloor", () => {
  const preset = (contextSize: number | null, contextUnlimited = false) => ({ contextSize, contextUnlimited });

  it.each([
    { raw: 5000, p: preset(16000), out: 5000 },
    { raw: 200, p: preset(16000), out: 1000 },
    { raw: 20000, p: preset(16000), out: 14400 },
    // Окно меньше пола: верхняя граница ниже нижней — побеждает нижняя (как clamp в Hono).
    { raw: 3000, p: preset(800), out: 1000 },
    { raw: 300, p: preset(16000, true), out: 300 },
    { raw: -5, p: preset(null), out: 0 },
    { raw: 7000, p: null, out: 7000 },
  ])("$raw при $p → $out", ({ raw, p, out }) => {
    expect(clampStoredCompactFloor(raw, p)).toBe(out);
  });
});
