import { useEffect, useRef } from "react";

const LONG_PRESS_MS = 500;

/**
 * Долгое нажатие/нажатие-и-удержание для триггера контекстного меню на кнопке, у которой уже есть
 * обычный onClick (тоггл показа перевода). Долгое нажатие подавляет следующий click через
 * onClickCapture — иначе отпускание пальца/кнопки после срабатывания таймера ещё и тоглило бы перевод.
 */
export function useLongPress(onLongPress: () => void, ms: number = LONG_PRESS_MS) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);

  const start = () => {
    fired.current = false;
    timer.current = setTimeout(() => {
      fired.current = true;
      onLongPress();
    }, ms);
  };

  const clear = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  // Таймер может пережить компонент (нажали и ушли со страницы/удалили сообщение до срабатывания) —
  // без этого onLongPress вызвался бы на уже отмонтированном инстансе.
  useEffect(() => clear, []);

  return {
    onPointerDown: start,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    // ПКМ на десктопе — то же меню, вместо системного контекстного.
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      onLongPress();
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (fired.current) {
        e.preventDefault();
        e.stopPropagation();
        fired.current = false;
      }
    },
  };
}
