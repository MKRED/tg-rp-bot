import { startTransition } from "react";
import { useNavigate } from "react-router-dom";
import type { To, NavigateOptions } from "react-router-dom";

/**
 * Заменяет useNavigate — оборачивает каждый navigate в startTransition.
 * При ленивой загрузке страниц React удерживает текущий UI до готовности чанка,
 * а не сразу показывает Suspense fallback. Выход (exit-анимация) успевает проиграть.
 */
export function useTransitionNavigate() {
  const navigate = useNavigate();
  return (to: To | number, options?: NavigateOptions) =>
    startTransition(() => {
      if (typeof to === "number") navigate(to);
      else navigate(to, options);
    });
}
