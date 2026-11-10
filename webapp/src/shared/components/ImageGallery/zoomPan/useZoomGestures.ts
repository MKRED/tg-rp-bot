import { useEffect, useRef } from "react";
import type { Point } from "./math";
import type { ZoomHandle } from "./useZoomPan";

/** Скорость броска — по движению за последние ~100 мс (как у ленты). */
const VELOCITY_WINDOW_MS = 100;
/** Чувствительность колеса: обычное колесо и пинч тачпада (ctrlKey, дельты мельче). */
const WHEEL_SPEED = 0.0015;
const WHEEL_PINCH_SPEED = 0.01;

interface Sample extends Point {
  t: number;
}

/** Идущий жест: пальцы на сцене и что они делают. */
interface Gesture {
  zoom: ZoomHandle;
  pointers: Map<number, Point>;
  mode: "none" | "pan" | "pinch";
  pinchStart: [Point, Point];
  panId: number;
  panStart: Point;
  samples: Sample[];
  /** Снять слушатели и забыть жест (без доводки картинки). */
  dispose: () => void;
}

/**
 * Пинч, перетаскивание приближенной картинки и колесо на сцене галереи. Один палец при 1× здесь не
 * обрабатывается — это листание ленты (useSwipeTrack, он же отменяет протяжку при втором пальце).
 * Пальцы меняются на ходу: из пинча снят один — оставшийся перетаскивает картинку без рывка (begin()
 * берёт текущее состояние за новую точку отсчёта).
 */
export function useZoomGestures(zoomRef: React.RefObject<ZoomHandle | null>, stageRef: React.RefObject<HTMLElement | null>) {
  const gesture = useRef<Gesture | null>(null);

  const toStage = (clientX: number, clientY: number): Point => {
    const r = stageRef.current?.getBoundingClientRect();
    return { x: clientX - (r?.left ?? 0), y: clientY - (r?.top ?? 0) };
  };
  const toStageRef = useRef(toStage);
  toStageRef.current = toStage;

  // Колесо — только нативным слушателем: у React onWheel пассивный, preventDefault не сработает.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
      const factor = Math.exp(-delta * (e.ctrlKey ? WHEEL_PINCH_SPEED : WHEEL_SPEED));
      zoomRef.current?.zoomBy(toStageRef.current(e.clientX, e.clientY), factor);
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [stageRef, zoomRef]);

  const pair = (g: Gesture): [Point, Point] => {
    const [a, b] = [...g.pointers.values()];
    return [a!, b!];
  };
  const startPinch = (g: Gesture) => {
    g.zoom.begin();
    g.mode = "pinch";
    g.pinchStart = pair(g);
  };
  const startPan = (g: Gesture, id: number, t: number) => {
    g.zoom.begin();
    g.mode = "pan";
    g.panId = id;
    g.panStart = g.pointers.get(id)!;
    g.samples = [{ ...g.panStart, t }];
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const p = toStage(e.clientX, e.clientY);
    let current = gesture.current;
    // Нажат указатель, который жест уже держит (или снова мышь): его отпускание потерялось — например,
    // кнопку отпустили за окном. Завершаем старый жест (картинку — в пределы) и начинаем новый.
    if (current && (current.pointers.has(e.pointerId) || e.pointerType === "mouse")) {
      current.dispose();
      current.zoom.end({ x: 0, y: 0 });
      current = null;
    }
    if (current) {
      // Ещё палец на идущем жесте — пинч (мышь второй «палец» не даёт).
      if (e.pointerType === "mouse") return;
      current.pointers.set(e.pointerId, p);
      startPinch(current);
      return;
    }
    const zoom = zoomRef.current;
    if (!zoom || (e.pointerType === "mouse" && e.button !== 0)) return;

    const g: Gesture = {
      zoom,
      pointers: new Map([[e.pointerId, p]]),
      mode: "none",
      pinchStart: [p, p],
      panId: -1,
      panStart: p,
      samples: [],
      dispose: () => {},
    };
    gesture.current = g;
    if (zoom.zoomed()) startPan(g, e.pointerId, e.timeStamp);

    const move = (ev: PointerEvent) => {
      if (!g.pointers.has(ev.pointerId)) return;
      const q = toStageRef.current(ev.clientX, ev.clientY);
      g.pointers.set(ev.pointerId, q);
      if (g.mode === "pinch" && g.pointers.size >= 2) g.zoom.pinch(g.pinchStart, pair(g));
      if (g.mode === "pan" && ev.pointerId === g.panId) {
        g.samples.push({ ...q, t: ev.timeStamp });
        while (g.samples.length > 2 && ev.timeStamp - g.samples[0]!.t > VELOCITY_WINDOW_MS) g.samples.shift();
        g.zoom.pan(q.x - g.panStart.x, q.y - g.panStart.y);
      }
    };
    const up = (ev: PointerEvent) => {
      if (!g.pointers.delete(ev.pointerId)) return;
      if (g.mode === "pinch") {
        if (g.pointers.size >= 2) startPinch(g);
        else if (g.pointers.size === 1) startPan(g, [...g.pointers.keys()][0]!, ev.timeStamp);
        else g.zoom.end({ x: 0, y: 0 });
      } else if (g.mode === "pan" && ev.pointerId === g.panId) {
        g.mode = "none";
        g.zoom.end(ev.type === "pointercancel" ? { x: 0, y: 0 } : velocityOf(g.samples, ev.timeStamp));
      }
      if (g.pointers.size === 0) g.dispose();
    };
    g.dispose = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (gesture.current === g) gesture.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  return { onPointerDown, toStage };
}

/** Скорость пальца, px/с, по последним ~100 мс: остановился и отпустил — ноль, а не средняя за жест. */
function velocityOf(samples: Sample[], now: number): Point {
  const last = samples[samples.length - 1];
  const first = samples.find((s) => now - s.t <= VELOCITY_WINDOW_MS);
  if (!last || !first || last.t <= first.t || now - last.t > VELOCITY_WINDOW_MS) return { x: 0, y: 0 };
  const dt = (last.t - first.t) / 1000;
  return { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt };
}
