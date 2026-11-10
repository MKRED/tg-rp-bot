import type { MotionValue } from "framer-motion";
import { useRef } from "react";
import { swipeStep } from "./swipeStep";

/** Сопротивление на краю: за последней картинкой лента идёт за пальцем втрое медленнее. */
const EDGE_RESISTANCE = 0.3;
/** Скорость броска считаем по движению за последние ~100 мс. */
const VELOCITY_WINDOW_MS = 100;

interface SwipeTrackOptions {
  x: MotionValue<number>;
  /** Листать можно (картинок больше одной и текущая не приближена). */
  enabled: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  width: () => number;
  /** Палец отпущен: −1/+1 — листать, 0 — вернуть ленту на место. */
  onRelease: (step: -1 | 0 | 1) => void;
}

/**
 * Лента идёт за пальцем, отпустили — решаем, листать ли (swipeStep). Свой обработчик, а не drag из
 * framer-motion: второй палец (пинч-зум) должен отменять протяжку, а drag этого не умеет.
 */
export function useSwipeTrack({ x, enabled, hasPrev, hasNext, width, onRelease }: SwipeTrackOptions) {
  const opts = useRef({ enabled, hasPrev, hasNext, width, onRelease });
  opts.current = { enabled, hasPrev, hasNext, width, onRelease };
  const active = useRef<{ id: number; startX: number; samples: { x: number; t: number }[]; cancel: () => void } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    // Второй палец — это пинч: протяжку отменяем, ленту возвращаем.
    if (active.current) {
      active.current.cancel();
      opts.current.onRelease(0);
      return;
    }
    if (!opts.current.enabled || (e.pointerType === "mouse" && e.button !== 0)) return;

    const id = e.pointerId;
    const startX = e.clientX;
    const samples = [{ x: startX, t: e.timeStamp }];

    const offsetOf = (clientX: number) => {
      const dx = clientX - startX;
      const { hasPrev: prev, hasNext: next } = opts.current;
      return (dx > 0 && !prev) || (dx < 0 && !next) ? dx * EDGE_RESISTANCE : dx;
    };
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      samples.push({ x: ev.clientX, t: ev.timeStamp });
      while (samples.length > 2 && ev.timeStamp - samples[0]!.t > VELOCITY_WINDOW_MS) samples.shift();
      x.set(offsetOf(ev.clientX));
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      cleanup();
      const first = samples[0]!;
      const dt = ev.timeStamp - first.t;
      const velocity = dt > 0 ? ((ev.clientX - first.x) / dt) * 1000 : 0;
      const { hasPrev: prev, hasNext: next, width: w } = opts.current;
      opts.current.onRelease(ev.type === "pointercancel" ? 0 : swipeStep(offsetOf(ev.clientX), velocity, w(), prev, next));
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      active.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    active.current = { id, startX, samples, cancel: cleanup };
  };

  return { onPointerDown };
}
