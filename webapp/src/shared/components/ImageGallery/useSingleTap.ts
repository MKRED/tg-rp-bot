import { useEffect, useRef } from "react";
import { DOUBLE_TAP_MS, isTap } from "./tap";

/**
 * Одиночный тап по полю картинки. Срабатывает с задержкой окна двойного тапа: второй тап в нём — это
 * зум библиотеки, и одиночный тогда отменяется. Касание вторым пальцем (пинч) тапом не считается.
 */
export function useSingleTap(onTap: () => void) {
  const down = useRef<{ x: number; y: number; t: number; id: number } | null>(null);
  const pointers = useRef(0);
  const multi = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastTap = useRef(0);
  const tapRef = useRef(onTap);
  tapRef.current = onTap;

  useEffect(() => () => clearTimeout(timer.current), []);

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current += 1;
    if (pointers.current > 1) multi.current = true;
    else {
      multi.current = false;
      down.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId };
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current = Math.max(0, pointers.current - 1);
    const start = down.current;
    if (!start || start.id !== e.pointerId) return;
    down.current = null;
    if (multi.current || !isTap(e.clientX - start.x, e.clientY - start.y, e.timeStamp - start.t)) return;

    const now = e.timeStamp;
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      // Второй тап — двойной: зум, панели не трогаем.
      clearTimeout(timer.current);
      lastTap.current = 0;
      return;
    }
    lastTap.current = now;
    timer.current = setTimeout(() => tapRef.current(), DOUBLE_TAP_MS);
  };

  const onPointerCancel = () => {
    pointers.current = Math.max(0, pointers.current - 1);
    down.current = null;
  };

  return { onPointerDown, onPointerUp, onPointerCancel };
}
