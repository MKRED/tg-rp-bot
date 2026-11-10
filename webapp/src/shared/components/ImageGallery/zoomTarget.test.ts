import { describe, expect, it } from "vitest";
import { doubleTapTarget } from "./zoomTarget";

// Экран 400×800, картинка 400×200 по центру (y = 300).
const base = { x: 0, y: 300, scale: 1, maxScale: 5, wrapperW: 400, wrapperH: 800, contentW: 400, contentH: 200 };
const S = Math.exp(0.9);

describe("doubleTapTarget", () => {
  it("приближает, оставляя точку под пальцем на месте", () => {
    const t = doubleTapTarget({ ...base, px: 200, py: 400 });
    expect(t.scale).toBeCloseTo(S);
    expect(t.x).toBeCloseTo(200 - 200 * S);
    expect(t.y).toBeCloseTo(400 - 100 * S);
  });

  it("тап по чёрному полю у узкой картинки не утягивает поле в кадр", () => {
    // Картинка 200×800 по центру (x = 100), тап левее неё — край картинки встаёт к краю экрана.
    const narrow = { ...base, x: 100, y: 0, contentW: 200, contentH: 800 };
    expect(doubleTapTarget({ ...narrow, px: 10, py: 400 }).x).toBe(0);
    expect(doubleTapTarget({ ...narrow, px: 390, py: 400 }).x).toBeCloseTo(400 - 200 * S);
  });

  it("сторону меньше экрана держит по центру", () => {
    // Высота 200·2.46 ≈ 492 < 800 — по вертикали центр, даже если тапнули у верхнего края картинки.
    const t = doubleTapTarget({ ...base, px: 200, py: 310 });
    expect(t.y).toBeCloseTo((800 - 200 * S) / 2);
  });

  it("приближенную возвращает к 1× по центру", () => {
    expect(doubleTapTarget({ ...base, x: -300, y: -50, scale: 3, px: 100, py: 100 })).toEqual({ x: 0, y: 300, scale: 1 });
  });

  it("не выходит за максимум", () => {
    expect(doubleTapTarget({ ...base, maxScale: 2, px: 200, py: 400 }).scale).toBe(2);
  });
});
