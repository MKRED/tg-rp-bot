import type { MotionValue } from "framer-motion";
import { useRef } from "react";
import { nearestStep, swipeStep } from "./swipeStep";

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
  /** Палец лёг на ленту: если она ещё доезжает — перехватить её с того места, где она сейчас. */
  onGrab: () => void;
  /** Палец отпущен: −1/+1 — листать, 0 — вернуть ленту на место; velocity — скорость пальца, px/с. */
  onRelease: (step: -1 | 0 | 1, velocity: number) => void;
}

/**
 * Лента идёт за пальцем, отпустили — решаем, листать ли (swipeStep). Свой обработчик, а не drag из
 * framer-motion: второй палец (пинч-зум) должен отменять протяжку, а drag этого не умеет.
 */
export function useSwipeTrack({ x, enabled, hasPrev, hasNext, width, onGrab, onRelease }: SwipeTrackOptions) {
  const opts = useRef({ enabled, hasPrev, hasNext, width, onGrab, onRelease });
  opts.current = { enabled, hasPrev, hasNext, width, onGrab, onRelease };
  const active = useRef<{ id: number; startX: number; samples: { x: number; t: number }[]; cancel: () => void } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    // Второй палец — это пинч: протяжку отменяем, ленту возвращаем.
    if (active.current) {
      active.current.cancel();
      opts.current.onRelease(0, 0);
      return;
    }
    if (!opts.current.enabled || (e.pointerType === "mouse" && e.button !== 0)) return;

    // Лента могла ещё доезжать — перехватываем её, и протяжка продолжается с её текущего сдвига.
    opts.current.onGrab();
    const base = x.get();
    const id = e.pointerId;
    const startX = e.clientX;
    const samples = [{ x: startX, t: e.timeStamp }];

    const offsetOf = (clientX: number) => {
      const offset = base + clientX - startX;
      const { hasPrev: prev, hasNext: next } = opts.current;
      return (offset > 0 && !prev) || (offset < 0 && !next) ? offset * EDGE_RESISTANCE : offset;
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
      // Скорость — по последним ~100 мс: палец остановился и отпустил — скорость нулевая, а не средняя за жест.
      const recent = samples.find((s) => ev.timeStamp - s.t <= VELOCITY_WINDOW_MS);
      const dt = recent ? ev.timeStamp - recent.t : 0;
      const velocity = recent && dt > 0 ? ((ev.clientX - recent.x) / dt) * 1000 : 0;
      const { hasPrev: prev, hasNext: next, width: w } = opts.current;
      const offset = offsetOf(ev.clientX);
      // Перехваченная на ходу лента (base ≠ 0) доводится к ближайшей картинке, свежий жест — по порогу.
      const decide = base === 0 ? swipeStep : nearestStep;
      const step = ev.type === "pointercancel" ? 0 : decide(offset, velocity, w(), prev, next);
      opts.current.onRelease(step, velocity);
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
