/** Двойной тап приближает в e^step раз (~2.5×), а не прыгает в максимум. */
export const DOUBLE_TAP_STEP = 0.9;

export interface ZoomTargetInput {
  /** Точка тапа относительно обёртки зума, px. */
  px: number;
  py: number;
  /** Текущее состояние трансформации (сдвиг содержимого и масштаб). */
  x: number;
  y: number;
  scale: number;
  maxScale: number;
  /** Размеры обёртки и содержимого (картинки) при масштабе 1. */
  wrapperW: number;
  wrapperH: number;
  contentW: number;
  contentH: number;
}

export interface ZoomTarget {
  x: number;
  y: number;
  scale: number;
}

/** Меньшая обёртки сторона — по центру, большая — не дальше краёв (без чёрных полей в кадре). */
function fitAxis(pos: number, size: number, wrapper: number): number {
  if (size <= wrapper) return (wrapper - size) / 2;
  return Math.min(0, Math.max(wrapper - size, pos));
}

/**
 * Куда ведёт двойной тап: приближенную картинку — обратно к 1× по центру, иначе приближаем так, чтобы
 * точка под пальцем осталась на месте (насколько пускают края картинки).
 */
export function doubleTapTarget(i: ZoomTargetInput): ZoomTarget {
  const scale = i.scale > 1.01 ? 1 : Math.min(i.maxScale, i.scale * Math.exp(DOUBLE_TAP_STEP));
  const k = scale / i.scale;
  const x = i.px - (i.px - i.x) * k;
  const y = i.py - (i.py - i.y) * k;
  return {
    x: fitAxis(x, i.contentW * scale, i.wrapperW),
    y: fitAxis(y, i.contentH * scale, i.wrapperH),
    scale,
  };
}
