import { useEffect, useRef } from "react";
import { DOUBLE_TAP_MS, isNearTap, isTap } from "./tap";

interface TapHandlers {
  /** Одиночный тап — срабатывает с задержкой окна двойного тапа. */
  onTap: () => void;
  /** Двойной тап — сразу по второму отпусканию, координаты экрана. */
  onDoubleTap: (clientX: number, clientY: number) => void;
}

/**
 * Одиночный и двойной тап по полю картинки — одним окном (DOUBLE_TAP_MS). Двойной тап свой, а не
 * библиотеки зума: у той окно 200 мс между касаниями (тапы через 200–300 мс не давали ничего — ни зума,
 * ни панелей), а её зум обрывал эмулированный mousedown, который браузер шлёт после касания.
 * Касание вторым пальцем (пинч) тапом не считается.
 */
export function useTaps({ onTap, onDoubleTap }: TapHandlers) {
  const down = useRef<{ x: number; y: number; t: number; id: number } | null>(null);
  const pointers = useRef(0);
  const multi = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const handlers = useRef({ onTap, onDoubleTap });
  handlers.current = { onTap, onDoubleTap };

  useEffect(() => () => clearTimeout(timer.current), []);

  const onPointerDown = (e: React.PointerEvent) => {
    // Без этого после касания браузер шлёт эмулированные mousedown/mouseup, а библиотека зума на mousedown
    // останавливает идущую анимацию — зум двойным тапом обрывался на старте. click при этом остаётся.
    if (e.pointerType !== "mouse") e.preventDefault();
    // Новое касание в окне двойного тапа: ждущий одиночный тап снимаем сразу — иначе он сработал бы
    // до отпускания второго (панели мигнули бы вместе с зумом). Не тап получился — одиночного тоже нет.
    clearTimeout(timer.current);
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

    const prev = lastTap.current;
    // Второй тап коснулся в окне после отпускания первого и рядом с ним — двойной (удержание пальца
    // в окно не входит). Тап в другом конце экрана — новый одиночный.
    if (prev && start.t - prev.t < DOUBLE_TAP_MS && isNearTap(e.clientX - prev.x, e.clientY - prev.y)) {
      lastTap.current = null;
      const { clientX, clientY } = e;
      // Зум — после touchend/mouseup этого же касания: на них библиотека завершает протяжку и, если
      // позиция успела сдвинуться, выравнивает картинку своей анимацией, обрывая нашу.
      timer.current = setTimeout(() => handlers.current.onDoubleTap(clientX, clientY), 0);
      return;
    }
    lastTap.current = { t: e.timeStamp, x: e.clientX, y: e.clientY };
    timer.current = setTimeout(() => handlers.current.onTap(), DOUBLE_TAP_MS);
  };

  const onPointerCancel = () => {
    pointers.current = Math.max(0, pointers.current - 1);
    down.current = null;
  };

  /** Снять ждущий одиночный тап — касание пришлось на кнопку панели. */
  const cancelPending = () => clearTimeout(timer.current);

  return { onPointerDown, onPointerUp, onPointerCancel, cancelPending };
}
