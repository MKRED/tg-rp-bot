interface SlideKeyEvent {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  defaultPrevented: boolean;
}

/**
 * Стрелка ←/→ листает холст на компьютере: −1, +1 или null, если клавиша не наша.
 * С модификаторами не листаем — Alt+← в браузере это «назад», Shift/Ctrl+стрелки — выделение текста.
 */
export function slideKeyDelta(e: SlideKeyEvent): -1 | 1 | null {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return null;
  if (e.key === "ArrowLeft") return -1;
  if (e.key === "ArrowRight") return 1;
  return null;
}

/**
 * Стрелки не перехватываем, пока фокус в поле ввода (курсор в промпте), а также когда поверх открыто
 * окно или меню: там стрелки свои (навигация по пунктам, перевод в шторке).
 */
export function slideKeysBlocked(target: EventTarget | null): boolean {
  if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select"))) return true;
  return document.querySelector('[role="dialog"], [role="menu"]') !== null;
}
