import { describe, expect, it } from "vitest";
import {
  DOUBLE_TAP_STEP,
  type Geometry,
  axisBounds,
  clampTransform,
  doubleTapTarget,
  fitContain,
  panOverflow,
  pinchTransform,
  rubberAxis,
  rubberBand,
  softLimitScale,
  zoomAt,
} from "./math";

// Сцена 400×800, картинка вписана в 400×200 и стоит по центру (y = 300).
const g: Geometry = { stageW: 400, stageH: 800, contentW: 400, contentH: 200 };
const one = { x: 0, y: 300, scale: 1 };
const S = Math.exp(DOUBLE_TAP_STEP);

describe("fitContain", () => {
  it("широкая картинка упирается в ширину, высокая — в высоту", () => {
    expect(fitContain(2000, 1000, 400, 800)).toEqual({ w: 400, h: 200 });
    expect(fitContain(1000, 4000, 400, 800)).toEqual({ w: 200, h: 800 });
  });

  it("картинка без размеров (ещё не загружена) — нулевая", () => {
    expect(fitContain(0, 0, 400, 800)).toEqual({ w: 0, h: 0 });
  });
});

describe("axisBounds и clampTransform", () => {
  it("меньшая сцены сторона — только по центру, большая — между краями", () => {
    expect(axisBounds(200, 800)).toEqual([300, 300]);
    expect(axisBounds(1000, 400)).toEqual([-600, 0]);
  });

  it("приближенную картинку не пускает дальше краёв", () => {
    expect(clampTransform({ x: 50, y: -2000, scale: 3 }, g)).toEqual({ x: 0, y: 100, scale: 3 });
    expect(clampTransform({ x: -5000, y: 0, scale: 3 }, g).x).toBe(-800);
  });
});

describe("резинка", () => {
  it("за краем идёт медленнее пальца, но монотонно и не дальше размера сцены", () => {
    const a = rubberBand(50, 400);
    const b = rubberBand(200, 400);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(50);
    expect(b).toBeGreaterThan(a);
    expect(rubberBand(1e9, 400)).toBeLessThanOrEqual(400);
    expect(rubberBand(-50, 400)).toBeCloseTo(-a);
  });

  it("внутри границ сдвиг не трогает, за ними — резинка от края", () => {
    expect(rubberAxis(-300, 1200, 400)).toBe(-300);
    expect(rubberAxis(100, 1200, 400)).toBeCloseTo(rubberBand(100, 400));
    expect(rubberAxis(-900, 1200, 400)).toBeCloseTo(-800 + rubberBand(-100, 400));
  });
});

describe("panOverflow", () => {
  it("сколько сдвига не влезло в края по горизонтали", () => {
    expect(panOverflow({ x: -300, y: 0, scale: 3 }, g)).toBe(0);
    expect(panOverflow({ x: 40, y: 0, scale: 3 }, g)).toBe(40);
    expect(panOverflow({ x: -850, y: 0, scale: 3 }, g)).toBe(-50);
  });
});

describe("softLimitScale", () => {
  it("в пределах масштаб не меняет, за ними тянется туже, но монотонно", () => {
    expect(softLimitScale(2, 1, 5)).toBe(2);
    const a = softLimitScale(6, 1, 5);
    const b = softLimitScale(8, 1, 5);
    expect(a).toBeGreaterThan(5);
    expect(a).toBeLessThan(6);
    expect(b).toBeGreaterThan(a);
    const c = softLimitScale(0.5, 1, 5);
    expect(c).toBeGreaterThan(0.5);
    expect(c).toBeLessThan(1);
  });
});

describe("zoomAt", () => {
  it("точка картинки под курсором остаётся на месте", () => {
    const t = zoomAt(one, { x: 100, y: 350 }, 2);
    // Точка картинки (100, 50) при масштабе 2 — на месте курсора.
    expect(t.x + 100 * 2).toBeCloseTo(100);
    expect(t.y + 50 * 2).toBeCloseTo(350);
  });
});

describe("pinchTransform", () => {
  const start = one;
  const a = { x: 150, y: 400 };
  const b = { x: 250, y: 400 };

  it("пальцы разошлись вдвое — масштаб вдвое, точка между пальцами на месте", () => {
    const t = pinchTransform(start, [a, b], [{ x: 100, y: 400 }, { x: 300, y: 400 }]);
    expect(t.scale).toBeCloseTo(2);
    // Точка картинки (200, 100) была в середине (200, 400) — там и осталась.
    expect(t.x + 200 * 2).toBeCloseTo(200);
    expect(t.y + 100 * 2).toBeCloseTo(400);
  });

  it("пальцы сдвинулись вместе — картинка едет за ними без зума", () => {
    const t = pinchTransform(start, [a, b], [{ x: 180, y: 380 }, { x: 280, y: 380 }]);
    expect(t).toEqual({ x: 30, y: 280, scale: 1 });
  });

  it("ограничение масштаба применяется к «сырому» значению", () => {
    const t = pinchTransform(start, [a, b], [{ x: 0, y: 400 }, { x: 400, y: 400 }], (raw) => Math.min(raw, 2));
    expect(t.scale).toBe(2);
  });
});

describe("doubleTapTarget", () => {
  it("приближает, оставляя точку под пальцем на месте", () => {
    const t = doubleTapTarget(one, { x: 200, y: 400 }, g, 5);
    expect(t.scale).toBeCloseTo(S);
    expect(t.x).toBeCloseTo(200 - 200 * S);
    expect(t.y).toBeCloseTo(400 - 100 * S);
  });

  it("тап по чёрному полю у узкой картинки не утягивает поле в кадр", () => {
    // Картинка 200×800 по центру (x = 100), тап левее неё — край картинки встаёт к краю экрана.
    const narrow: Geometry = { ...g, contentW: 200, contentH: 800 };
    const t = { x: 100, y: 0, scale: 1 };
    expect(doubleTapTarget(t, { x: 10, y: 400 }, narrow, 5).x).toBe(0);
    expect(doubleTapTarget(t, { x: 390, y: 400 }, narrow, 5).x).toBeCloseTo(400 - 200 * S);
  });

  it("сторону меньше экрана держит по центру", () => {
    // Высота 200·2.46 ≈ 492 < 800 — по вертикали центр, даже если тапнули у верхнего края картинки.
    const t = doubleTapTarget(one, { x: 200, y: 310 }, g, 5);
    expect(t.y).toBeCloseTo((800 - 200 * S) / 2);
  });

  it("приближенную возвращает к 1× по центру", () => {
    expect(doubleTapTarget({ x: -300, y: -50, scale: 3 }, { x: 100, y: 100 }, g, 5)).toEqual(one);
  });

  it("не выходит за максимум", () => {
    expect(doubleTapTarget(one, { x: 200, y: 400 }, g, 2).scale).toBe(2);
  });
});
