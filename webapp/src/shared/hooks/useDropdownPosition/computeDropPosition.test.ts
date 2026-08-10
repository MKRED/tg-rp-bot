import { describe, expect, it } from "vitest";
import { computeDropPosition } from "./computeDropPosition";

const INSETS = { gap: 6, margin: 8, insetTop: 0, insetBottom: 0, minMenuWidth: 160 };
const VIEWPORT = { width: 400, height: 800 };

describe("computeDropPosition", () => {
  it("opens down when there is more space below the trigger", () => {
    const result = computeDropPosition({ top: 100, bottom: 130, left: 200, right: 260 }, VIEWPORT, INSETS);
    expect(result.dir).toBe("down");
    expect(result.maxHeight).toBeCloseTo(800 - 130 - 6 - 8);
  });

  it("opens up when there is more space above the trigger", () => {
    const result = computeDropPosition({ top: 700, bottom: 730, left: 200, right: 260 }, VIEWPORT, INSETS);
    expect(result.dir).toBe("up");
    expect(result.maxHeight).toBeCloseTo(700 - 6 - 8);
  });

  it("never returns a negative maxHeight when the trigger has no room on either side", () => {
    const result = computeDropPosition({ top: -50, bottom: 850, left: 200, right: 260 }, VIEWPORT, INSETS);
    expect(result.maxHeight).toBeGreaterThanOrEqual(0);
  });

  it("accounts for safe-area insets when picking the side and clamping height", () => {
    const result = computeDropPosition(
      { top: 100, bottom: 130, left: 200, right: 260 },
      VIEWPORT,
      { gap: 6, margin: 8, insetTop: 0, insetBottom: 650, minMenuWidth: 160 },
    );
    // Место снизу почти всё съедено inset-ом — раскрытие должно уйти вверх.
    expect(result.dir).toBe("up");
  });

  it("aligns end (right edge to trigger) when there is enough room to the left of the trigger", () => {
    // Триггер у правого края экрана — слева от него достаточно места под меню.
    const result = computeDropPosition({ top: 100, bottom: 130, left: 350, right: 392 }, VIEWPORT, INSETS);
    expect(result.align).toBe("end");
    expect(result.maxWidth).toBeGreaterThanOrEqual(160);
  });

  it("aligns start (left edge to trigger) when the trigger is too close to the left edge for end-align", () => {
    // Триггер у самого левого края — вправо от его правого края всего 40px, меньше minMenuWidth.
    // Раньше меню всегда прижималось правым краем и в этом случае улетало за левый край экрана.
    const result = computeDropPosition({ top: 100, bottom: 130, left: 4, right: 44 }, VIEWPORT, INSETS);
    expect(result.align).toBe("start");
    // Вправо от левого края триггера места намного больше 160px — меню не обрезано.
    expect(result.maxWidth).toBeGreaterThanOrEqual(160);
  });

  it("never returns a negative maxWidth when the viewport is narrower than the menu on both sides", () => {
    const result = computeDropPosition(
      { top: 100, bottom: 130, left: 90, right: 110 },
      { width: 100, height: 800 },
      INSETS,
    );
    expect(result.maxWidth).toBeGreaterThanOrEqual(0);
  });
});
