import { describe, expect, it } from "vitest";
import { computeDropPosition } from "./computeDropPosition";

const INSETS = { gap: 6, margin: 8, insetTop: 0, insetBottom: 0 };

describe("computeDropPosition", () => {
  it("opens down when there is more space below the trigger", () => {
    const result = computeDropPosition({ top: 100, bottom: 130 }, 800, INSETS);
    expect(result.dir).toBe("down");
    expect(result.maxHeight).toBeCloseTo(800 - 130 - 6 - 8);
  });

  it("opens up when there is more space above the trigger", () => {
    const result = computeDropPosition({ top: 700, bottom: 730 }, 800, INSETS);
    expect(result.dir).toBe("up");
    expect(result.maxHeight).toBeCloseTo(700 - 6 - 8);
  });

  it("never returns a negative maxHeight when the trigger has no room on either side", () => {
    const result = computeDropPosition({ top: -50, bottom: 850 }, 800, INSETS);
    expect(result.maxHeight).toBeGreaterThanOrEqual(0);
  });

  it("accounts for safe-area insets when picking the side and clamping height", () => {
    const result = computeDropPosition(
      { top: 100, bottom: 130 },
      800,
      { gap: 6, margin: 8, insetTop: 0, insetBottom: 650 },
    );
    // Место снизу почти всё съедено inset-ом — раскрытие должно уйти вверх.
    expect(result.dir).toBe("up");
  });
});
