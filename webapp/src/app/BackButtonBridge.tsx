import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { backButton } from "@telegram-apps/sdk-react";
import { ROUTES } from "./routes";

/**
 * Мост нативной кнопки «Назад» Telegram ↔ роутер.
 *
 * На вложенных экранах показываем кнопку, по нажатию делаем navigate(-1) (шаг назад
 * по истории роутера); на главной — прячем. Все вызовы SDK обёрнуты в isAvailable(),
 * т.к. вне Telegram (dev-браузер) кнопки нет — тогда мост просто ничего не делает.
 */
export function BackButtonBridge() {
  const navigate = useNavigate();
  const location = useLocation();

  // Монтируем кнопку один раз за время жизни приложения.
  useEffect(() => {
    if (backButton.mount.isAvailable()) backButton.mount();
    return () => {
      if (backButton.isMounted()) backButton.unmount();
    };
  }, []);

  // Подписка на нажатие: уводим на шаг назад по истории.
  useEffect(() => {
    if (!backButton.onClick.isAvailable()) return;
    return backButton.onClick(() => navigate(-1));
  }, [navigate]);

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
