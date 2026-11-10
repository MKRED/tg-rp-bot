import { type AnimationPlaybackControls, animate, useMotionValue } from "framer-motion";
import { useEffect, useMemo, useRef } from "react";
import {
  type Geometry,
  type Point,
  type Transform,
  axisBounds,
  clampTransform,
  doubleTapTarget,
  pinchTransform,
  rubberTransform,
  softLimitScale,
  unrubberTransform,
  unsoftLimitScale,
  zoomAt,
} from "./math";

/** Масштаб, выше которого картинка считается приближенной (лента не листается, палец двигает картинку). */
const ZOOMED_FROM = 1.01;
/** Возврат в пределы после пинча — пружина без перелёта. */
const SETTLE_SPRING = { type: "spring", stiffness: 300, damping: 36, restDelta: 0.1 } as const;
/** Двойной тап — короткая плавная анимация, как было с библиотекой. */
const TAP_TWEEN = { duration: 0.25, ease: "easeOut" } as const;
/**
 * Инерция после броска: проезд = power · скорость (px/с), затухание timeConstant мс. Начальная скорость
 * картинки — power / timeConstant(с) от скорости пальца: при power = timeConstant / 1000 она продолжает
 * движение ровно со скоростью пальца (при большем power срывалась быстрее него). Упёрлась в край — пружина
 * к краю без перелёта (bounce*).
 */
const INERTIA = { type: "inertia", power: 0.28, timeConstant: 280, bounceStiffness: 400, bounceDamping: 40, restDelta: 0.5 } as const;
/** Потолок скорости броска, px/с: резкий взмах не уносит картинку через весь кадр. */
const MAX_THROW_SPEED = 2000;

/**
 * Управление зумом слайда. Точки — в координатах сцены (слайда), px. Жест — begin(), затем pan/pinch
 * считаются от состояния на begin (погрешность не копится), end() доводит картинку в пределы.
 */
export interface ZoomHandle {
  zoomed(): boolean;
  /** Начало жеста (или смена пальцев): остановить анимацию и запомнить текущее состояние. */
  begin(): void;
  pan(dx: number, dy: number): void;
  pinch(startPoints: readonly [Point, Point], points: readonly [Point, Point]): void;
  /** Пальцы отпущены: velocity — скорость пальца, px/с. */
  end(velocity: Point): void;
  /** Двойной тап: приблизить к точке или вернуть к 1×. */
  toggleAt(p: Point): void;
  /** Колесо/тачпад: умножить масштаб на factor вокруг точки. */
  zoomBy(p: Point, factor: number): void;
  /** Сразу к 1× по центру. */
  reset(): void;
}

/**
 * Зум и перетаскивание одной картинки. Картинку раскладывает CSS (вписана по центру слайда), а сдвиг и
 * масштаб — transform поверх раскладки с началом в левом верхнем углу: motion values, без ре-рендеров.
 * Математика (math.ts) считает в координатах сцены, здесь — перевод в сдвиг от разложенного положения.
 */
export function useZoomPan({ maxScale, onZoomChange }: { maxScale: number; onZoomChange: (zoomed: boolean) => void }) {
  const tx = useMotionValue(0);
  const ty = useMotionValue(0);
  const scale = useMotionValue(1);
  const imgRef = useRef<HTMLImageElement>(null);
  const onZoomRef = useRef(onZoomChange);
  onZoomRef.current = onZoomChange;

  useEffect(() => {
    let last = false;
    return scale.on("change", (s) => {
      const zoomed = s > ZOOMED_FROM;
      if (zoomed === last) return;
      last = zoomed;
      onZoomRef.current(zoomed);
    });
  }, [scale]);

  const handle = useMemo<ZoomHandle>(() => {
    let running: AnimationPlaybackControls[] = [];
    let start: Transform = { x: 0, y: 0, scale: 1 };
    let focus: Point | null = null;

    // Размеры меряем в момент жеста: раскладка (offsetWidth) не зависит от transform.
    const layout = (): { g: Geometry; left: number; top: number } | null => {
      const img = imgRef.current;
      const stage = img?.parentElement;
      if (!img || !stage || !img.offsetWidth) return null;
      const g = { stageW: stage.clientWidth, stageH: stage.clientHeight, contentW: img.offsetWidth, contentH: img.offsetHeight };
      return { g, left: (g.stageW - g.contentW) / 2, top: (g.stageH - g.contentH) / 2 };
    };
    const read = (l: { left: number; top: number }): Transform => ({ x: l.left + tx.get(), y: l.top + ty.get(), scale: scale.get() });
    const write = (l: { left: number; top: number }, t: Transform) => {
      tx.set(t.x - l.left);
      ty.set(t.y - l.top);
      scale.set(t.scale);
    };
    const stop = () => {
      running.forEach((c) => c.stop());
      running = [];
    };
    const animateTo = (l: { left: number; top: number }, t: Transform, options: typeof SETTLE_SPRING | typeof TAP_TWEEN) => {
      stop();
      running = [animate(tx, t.x - l.left, options), animate(ty, t.y - l.top, options), animate(scale, t.scale, options)];
    };

    return {
      zoomed: () => scale.get() > ZOOMED_FROM,
      begin() {
        stop();
        const l = layout();
        // Взяли картинку за краем (пружинит назад, остаток пинча) — отсчёт от «сырого» положения, иначе
        // резинка легла бы второй раз и картинка прыгнула бы на первом движении.
        if (l) start = unrubberTransform(read(l), l.g);
        focus = null;
      },
      pan(dx, dy) {
        const l = layout();
        if (l) write(l, rubberTransform({ x: start.x + dx, y: start.y + dy, scale: start.scale }, l.g));
      },
      pinch(startPoints, points) {
        const l = layout();
        if (!l) return;
        focus = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
        // Масштаб на старте мог быть уже «поджат» пределом — отношение пальцев прикладываем к «сырому».
        const rawStart = unsoftLimitScale(start.scale, 1, maxScale);
        const raw = pinchTransform(start, startPoints, points, (s) => softLimitScale((rawStart * s) / start.scale, 1, maxScale));
        write(l, rubberTransform(raw, l.g));
      },
      end(velocity) {
        const l = layout();
        if (!l) return;
        const cur = read(l);
        // Не приближена (в т.ч. пинчем ниже 1×) или пинч ушёл выше максимума — пружиной в пределы, вокруг
        // точки между пальцами.
        if (cur.scale <= ZOOMED_FROM || cur.scale > maxScale) {
          const s = cur.scale <= ZOOMED_FROM ? 1 : maxScale;
          const p = focus ?? { x: l.g.stageW / 2, y: l.g.stageH / 2 };
          animateTo(l, clampTransform(zoomAt(cur, p, s), l.g), SETTLE_SPRING);
          return;
        }
        // Приближена — по каждой оси: за краем (резинка) — пружиной к краю, иначе инерция броска с упором в края.
        stop();
        // Потолок — на модуль скорости, а не по осям: направление броска сохраняется.
        const speed = Math.hypot(velocity.x, velocity.y);
        const k = speed > MAX_THROW_SPEED ? MAX_THROW_SPEED / speed : 1;
        velocity = { x: velocity.x * k, y: velocity.y * k };
        const axis = (mv: typeof tx, v: number, size: number, stage: number, offset: number) => {
          const [min, max] = axisBounds(size, stage).map((b) => b - offset) as [number, number];
          const pos = mv.get();
          if (pos < min || pos > max) return animate(mv, Math.min(max, Math.max(min, pos)), { ...SETTLE_SPRING, velocity: v });
          // Цель для framer — точка, куда бросок довёл бы без краёв: при цели, равной текущему значению,
          // framer анимацию пропускает. Сама инерция цель считает сама (power · velocity).
          if (Math.abs(v) < 1) return null;
          return animate(mv, pos + INERTIA.power * v, { ...INERTIA, velocity: v, min, max });
        };
        running = [
          axis(tx, velocity.x, l.g.contentW * cur.scale, l.g.stageW, l.left),
          axis(ty, velocity.y, l.g.contentH * cur.scale, l.g.stageH, l.top),
        ].filter((c) => c !== null);
      },
      toggleAt(p) {
        const l = layout();
        if (l) animateTo(l, doubleTapTarget(read(l), p, l.g, maxScale), TAP_TWEEN);
      },
      zoomBy(p, factor) {
        stop();
        const l = layout();
        if (!l) return;
        const cur = read(l);
        const s = Math.min(maxScale, Math.max(1, cur.scale * factor));
        write(l, clampTransform(zoomAt(cur, p, s), l.g));
      },
      reset() {
        stop();
        tx.set(0);
        ty.set(0);
        scale.set(1);
      },
    };
  }, [tx, ty, scale, maxScale]);

  return { imgRef, handle, style: { x: tx, y: ty, scale, transformOrigin: "0 0" } };
}
