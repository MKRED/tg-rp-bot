import { useEffect, useRef } from "react";

interface GalleryKeys {
  /** Открыто меню «⋮»: Esc закрывает его (closeMenu), стрелки остаются ему. */
  menuOpen: boolean;
  closeMenu: () => void;
  go: (step: -1 | 1) => void;
  onClose: () => void;
}

/**
 * Клавиши галереи: Esc — закрыть, ←/→ — листать. При открытом меню «⋮» Esc закрывает меню, а не галерею:
 * меню открытое мышью держит фокус на «⋮», и свой Esc у выпадашки Mantine (ловит только при фокусе внутри
 * неё) не срабатывает.
 */
export function useGalleryKeys(keys: GalleryKeys) {
  // Обработчик живёт всю галерею, а текущая картинка и меню меняются — берём свежие значения.
  const ref = useRef(keys);
  ref.current = keys;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = ref.current;
      if (k.menuOpen) {
        if (e.key === "Escape") k.closeMenu();
        return;
      }
      if (e.key === "Escape") k.onClose();
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key === "ArrowLeft") k.go(-1);
      if (e.key === "ArrowRight") k.go(1);
    };
    // Перехват (capture): иначе Esc из выпадашки сначала закрыло бы меню (menuOpen → false) и, всплыв до
    // window, закрыло бы и галерею.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
}
