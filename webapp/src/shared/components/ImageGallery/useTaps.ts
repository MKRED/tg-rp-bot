import { useEffect, useRef } from "react";
import { DOUBLE_TAP_MS, isNearTap, isTap } from "./tap";

interface TapHandlers {
  /** Одиночный тап — срабатывает с задержкой окна двойного тапа. */
  onTap: () => void;
  /** Двойной тап — сразу по второму отпусканию, координаты экрана. */
  onDoubleTap: (clientX: number, clientY: number) => void;
}

/**
 * Одиночный и двойной тап по полю картинки — одним окном (DOUBLE_TAP_MS), чтобы одиночный не срабатывал
 * вместе с двойным. Касание вторым пальцем (пинч) тапом не считается.
 */
export function useTaps({ onTap, onDoubleTap }: TapHandlers) {
  const down = useRef<{ x: number; y: number; t: number; id: number } | null>(null);
  // Пальцы на сцене — по id, а не счётчиком: потерянное отпускание (тот же id нажат снова) не копится.
  const pointers = useRef(new Set<number>());
  const multi = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const handlers = useRef({ onTap, onDoubleTap });
  handlers.current = { onTap, onDoubleTap };

  useEffect(() => () => clearTimeout(timer.current), []);

  const onPointerDown = (e: React.PointerEvent) => {
    // Без эмулированных mousedown/mouseup после касания (click при этом остаётся): жестам они не нужны,
    // а фокус и выделение от них на сцене только мешают.
    if (e.pointerType !== "mouse") e.preventDefault();
    // Новое касание в окне двойного тапа: ждущий одиночный тап снимаем сразу — иначе он сработал бы
    // до отпускания второго (панели мигнули бы вместе с зумом). Не тап получился — одиночного тоже нет.
    clearTimeout(timer.current);
    // Этот же указатель уже «нажат» — его отпускание потерялось: начинаем с чистого листа.
    if (pointers.current.has(e.pointerId)) pointers.current.clear();
    pointers.current.add(e.pointerId);
    if (pointers.current.size > 1) multi.current = true;
    else {
      multi.current = false;
      down.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId };
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const start = down.current;
    if (!start || start.id !== e.pointerId) return;
    down.current = null;
    if (multi.current || !isTap(e.clientX - start.x, e.clientY - start.y, e.timeStamp - start.t)) return;

    const prev = lastTap.current;
    // Второй тап коснулся в окне после отпускания первого и рядом с ним — двойной (удержание пальца
    // в окно не входит). Тап в другом конце экрана — новый одиночный.
    if (prev && start.t - prev.t < DOUBLE_TAP_MS && isNearTap(e.clientX - prev.x, e.clientY - prev.y)) {
      lastTap.current = null;
      const { clientX, clientY } = e;
      // Зум — после того как жесты сцены обработают это же отпускание: в зуме оно завершает перетаскивание
      // (end() запускает доводку), и зум двойного тапа должен её сменить, а не наоборот.
      timer.current = setTimeout(() => handlers.current.onDoubleTap(clientX, clientY), 0);
      return;
    }
    lastTap.current = { t: e.timeStamp, x: e.clientX, y: e.clientY };
    timer.current = setTimeout(() => handlers.current.onTap(), DOUBLE_TAP_MS);
  };

  const onPointerCancel = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    down.current = null;
  };

  /** Снять ждущий одиночный тап — касание пришлось на кнопку панели. */
  const cancelPending = () => clearTimeout(timer.current);

  return { onPointerDown, onPointerUp, onPointerCancel, cancelPending };
}
