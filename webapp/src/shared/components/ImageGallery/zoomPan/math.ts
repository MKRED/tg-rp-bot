/**
 * Математика зума и перетаскивания картинки в полноэкранном просмотре — без DOM и React.
 *
 * Состояние `{ x, y, scale }`: сдвиг левого верхнего угла картинки внутри сцены (px) и масштаб
 * относительно вписанного размера (1 — картинка целиком помещается в сцену).
 */

export interface Transform {
  x: number;
  y: number;
  scale: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Размер сцены и вписанный размер картинки при масштабе 1. */
export interface Geometry {
  stageW: number;
  stageH: number;
  contentW: number;
  contentH: number;
}

/** Двойной тап приближает в e^step раз (~2.5×), а не прыгает в максимум. */
export const DOUBLE_TAP_STEP = 0.9;
/** Жёсткость «резинки» за краем: доля сдвига пальца, которую картинка проходит в самом начале. */
const RUBBER_K = 0.55;
/** Сопротивление масштаба за пределами: показатель степени (меньше — туже). */
const SCALE_RESISTANCE = 0.3;

/** Вписанный размер картинки: целиком в сцене, пропорции сохранены. */
export function fitContain(naturalW: number, naturalH: number, stageW: number, stageH: number): { w: number; h: number } {
  if (naturalW <= 0 || naturalH <= 0) return { w: 0, h: 0 };
  const k = Math.min(stageW / naturalW, stageH / naturalH);
  return { w: naturalW * k, h: naturalH * k };
}

/** Допустимый сдвиг по оси: меньшая сцены сторона стоит по центру, большая — не дальше краёв. */
export function axisBounds(size: number, stage: number): [min: number, max: number] {
  if (size <= stage) {
    const center = (stage - size) / 2;
    return [center, center];
  }
  return [stage - size, 0];
}

/** Сдвиг по оси, прижатый к допустимому (без чёрных полей в кадре). */
export function fitAxis(pos: number, size: number, stage: number): number {
  const [min, max] = axisBounds(size, stage);
  return Math.min(max, Math.max(min, pos));
}

/** Состояние, прижатое к краям по обеим осям. */
export function clampTransform(t: Transform, g: Geometry): Transform {
  return {
    x: fitAxis(t.x, g.contentW * t.scale, g.stageW),
    y: fitAxis(t.y, g.contentH * t.scale, g.stageH),
    scale: t.scale,
  };
}

/**
 * Резинка (как в iOS): за краем картинка идёт за пальцем всё медленнее (в начале — RUBBER_K от
 * сдвига пальца) и никогда не уходит дальше `size`. `over` — насколько палец увёл за край, знак сохраняется.
 */
export function rubberBand(over: number, size: number): number {
  if (size <= 0) return 0;
  const abs = Math.abs(over);
  return Math.sign(over) * ((abs * RUBBER_K * size) / (size + RUBBER_K * abs));
}

/** Сдвиг по оси при перетаскивании: внутри границ — как есть, за ними — с резинкой. */
export function rubberAxis(pos: number, size: number, stage: number): number {
  const [min, max] = axisBounds(size, stage);
  if (pos > max) return max + rubberBand(pos - max, stage);
  if (pos < min) return min + rubberBand(pos - min, stage);
  return pos;
}

/** Состояние при перетаскивании: за краями — резинка по обеим осям. */
export function rubberTransform(t: Transform, g: Geometry): Transform {
  return {
    x: rubberAxis(t.x, g.contentW * t.scale, g.stageW),
    y: rubberAxis(t.y, g.contentH * t.scale, g.stageH),
    scale: t.scale,
  };
}

/** Сколько горизонтального сдвига не помещается в края: >0 — картинку тянут вправо за левый край. */
export function panOverflow(t: Transform, g: Geometry): number {
  const [min, max] = axisBounds(g.contentW * t.scale, g.stageW);
  if (t.x > max) return t.x - max;
  if (t.x < min) return t.x - min;
  return 0;
}

/** Масштаб с сопротивлением за пределами [min, max]: пинч тянет дальше, но всё туже. */
export function softLimitScale(scale: number, min: number, max: number): number {
  if (scale > max) return max * (scale / max) ** SCALE_RESISTANCE;
  if (scale < min) return min * (scale / min) ** SCALE_RESISTANCE;
  return scale;
}

/** Масштаб `scale` вокруг точки сцены `p`: точка картинки под ней остаётся на месте. Без прижатия к краям. */
export function zoomAt(t: Transform, p: Point, scale: number): Transform {
  const k = scale / t.scale;
  return { x: p.x - (p.x - t.x) * k, y: p.y - (p.y - t.y) * k, scale };
}

const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y) || 1;

/**
 * Пинч двумя пальцами: масштаб — по отношению расстояний между пальцами, точка картинки, что была
 * между пальцами в начале, остаётся между ними сейчас (так работает и сдвиг двумя пальцами).
 * Считается от состояния на начало пинча, а не накоплением по кадрам — погрешность не копится.
 * Ограничения масштаба (softLimitScale) — на вызывающем: `scaleOf` получает «сырой» масштаб.
 */
export function pinchTransform(
  start: Transform,
  startPoints: readonly [Point, Point],
  points: readonly [Point, Point],
  scaleOf: (raw: number) => number = (raw) => raw,
): Transform {
  const scale = scaleOf(start.scale * (dist(points[0], points[1]) / dist(startPoints[0], startPoints[1])));
  const m0 = mid(startPoints[0], startPoints[1]);
  const m = mid(points[0], points[1]);
  const k = scale / start.scale;
  return { x: m.x - (m0.x - start.x) * k, y: m.y - (m0.y - start.y) * k, scale };
}

/**
 * Куда ведёт двойной тап в точку `p`: приближенную картинку — обратно к 1× по центру, иначе приближаем
 * так, чтобы точка под пальцем осталась на месте (насколько пускают края картинки).
 */
export function doubleTapTarget(t: Transform, p: Point, g: Geometry, maxScale: number): Transform {
  const scale = t.scale > 1.01 ? 1 : Math.min(maxScale, t.scale * Math.exp(DOUBLE_TAP_STEP));
  return clampTransform(zoomAt(t, p, scale), g);
}
