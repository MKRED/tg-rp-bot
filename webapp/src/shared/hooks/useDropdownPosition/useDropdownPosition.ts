import { useCallback, useEffect, useRef, useState } from "react";
import { computeDropPosition, type DropPosition } from "./computeDropPosition";

const MENU_GAP = 6;
const VIEWPORT_MARGIN = 8;
// Ширина "таблетки" LangPicker (см. min-width в LangPicker.css) — DropdownPicker меню full-width
// и это значение не использует, но общая геометрия для обоих потребителей.
const MIN_MENU_WIDTH = 160;

function safeAreaInset(varName: string): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  const value = parseFloat(raw);
  return Number.isFinite(value) ? value : 0;
}

/**
 * Управляет открытием выпадающего меню поверх триггера: перед открытием меряет реальное место
 * вокруг триггера (getBoundingClientRect) и выбирает сторону/высоту через computeDropPosition,
 * закрывает меню по клику вне и по скроллу (меню — position:absolute и после прокрутки страницы
 * съезжает вместе с триггером, рискуя зависнуть за краем вьюпорта). Общий кусок для всех
 * "самодельных" выпадающих списков проекта (замена нативного <select>, который Telegram webview
 * на ПК рисует системно-белым popup — см. DropdownPicker/LangPicker).
 */
export function useDropdownPosition() {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<DropPosition>({
    dir: "down",
    maxHeight: 0,
    align: "end",
    maxWidth: 0,
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const measure = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const insetTop =
      safeAreaInset("--tg-viewport-safe-area-inset-top") +
      safeAreaInset("--tg-viewport-content-safe-area-inset-top");
    const insetBottom =
      safeAreaInset("--tg-viewport-safe-area-inset-bottom") +
      safeAreaInset("--tg-viewport-content-safe-area-inset-bottom");
    setPosition(
      computeDropPosition(rect, { width: window.innerWidth, height: window.innerHeight }, {
        gap: MENU_GAP,
        margin: VIEWPORT_MARGIN,
        insetTop,
        insetBottom,
        minMenuWidth: MIN_MENU_WIDTH,
      }),
    );
  }, []);

  const toggle = useCallback(() => {
    if (!open) measure();
    setOpen((v) => !v);
  }, [open, measure]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  return { open, ...position, rootRef, triggerRef, toggle, close };
}
