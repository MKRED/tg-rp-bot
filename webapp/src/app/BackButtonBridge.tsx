import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { backButton } from "@telegram-apps/sdk-react";
import { ROUTES, parentPath } from "./routes";
import { useTransitionNavigate } from "./useTransitionNavigate";

/**
 * Мост нативной кнопки «Назад» Telegram ↔ роутер.
 *
 * На вложенных экранах показываем кнопку, по нажатию уходим к родительскому маршруту
 * (parentPath — вверх по иерархии, а не по истории), на главной — прячем. Навигация вверх,
 * а не navigate(-1): иначе после удаления пресета «Назад» вернул бы на его (уже мёртвый) URL.
 * Все вызовы SDK обёрнуты в isAvailable(): вне Telegram (dev-браузер) кнопки нет — мост молчит.
 */
export function BackButtonBridge() {
  const navigate = useTransitionNavigate();
  const location = useLocation();

  // Монтируем кнопку один раз за время жизни приложения.
  useEffect(() => {
    if (backButton.mount.isAvailable()) backButton.mount();
    return () => {
      if (backButton.isMounted()) backButton.unmount();
    };
  }, []);

  // Подписка на нажатие: уводим к родителю текущего экрана. Пересоздаём подписку при
  // смене пути, чтобы в замыкании был актуальный pathname (от него зависит родитель).
  // Если в state.returnTo передан явный путь возврата (напр. из настроек чата → редактирование
  // персонажа) — используем его вместо статического parentPath.
  useEffect(() => {
    if (!backButton.onClick.isAvailable()) return;
    const returnTo = (location.state as { returnTo?: string } | null)?.returnTo;
    return backButton.onClick(() => navigate(returnTo ?? parentPath(location.pathname)));
  }, [navigate, location.pathname, location.state]);

  // Показ/скрытие в зависимости от текущего маршрута.
  useEffect(() => {
    if (!backButton.isMounted()) return;
    if (location.pathname === ROUTES.home) {
      if (backButton.hide.isAvailable()) backButton.hide();
    } else {
      if (backButton.show.isAvailable()) backButton.show();
    }
  }, [location.pathname]);

  return null;
}
