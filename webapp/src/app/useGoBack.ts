import { useCallback } from "react";
import { useLocation } from "react-router-dom";
import { consumeBackInterceptor } from "../shared/telegram/backInterceptor";
import { checkNavigationGuards } from "../shared/telegram/navigationGuard";
import { backTarget, hasBackTarget } from "./routes";
import { useTransitionNavigate } from "./useTransitionNavigate";

/**
 * «Назад» вверх по иерархии экранов — общий для нативной кнопки Telegram (BackButtonBridge) и
 * кнопки в шапке в браузере (BackNavButton), чтобы обе вели в одно место.
 *
 * Навигация к родителю, а не navigate(-1): история браузера не всегда ведёт вверх (deep-link,
 * открытие по ссылке), а после удаления сущности вернула бы на её мёртвый URL.
 */
export function useGoBack(): { canGoBack: boolean; goBack: () => void } {
  const navigate = useTransitionNavigate();
  const { pathname, state } = useLocation();

  const goBack = useCallback(() => {
    // Сначала отдаём нажатие открытому оверлею (редактор кропа/лайтбокс): он закроется,
    // навигацию не делаем. Если оверлеев нет — спрашиваем гарды (напр. несохранённая форма
    // покажет confirm) и только потом уходим к родителю.
    if (consumeBackInterceptor()) return;
    checkNavigationGuards()
      .then((canLeave) => {
        if (canLeave) navigate(backTarget(pathname, state));
      })
      .catch((err) => console.error("Не удалось проверить гарды навигации", err));
  }, [navigate, pathname, state]);

  return { canGoBack: hasBackTarget(pathname), goBack };
}
