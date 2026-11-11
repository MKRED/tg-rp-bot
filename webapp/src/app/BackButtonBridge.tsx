import { useEffect } from "react";
import { backButton } from "@telegram-apps/sdk-react";
import { useGoBack } from "./useGoBack";

/**
 * Мост нативной кнопки «Назад» Telegram ↔ роутер.
 *
 * На вложенных экранах показываем кнопку, по нажатию уходим вверх по иерархии (useGoBack — тот же
 * переход, что у кнопки в шапке в браузере), на главной — прячем.
 * Все вызовы SDK обёрнуты в isAvailable(): вне Telegram (браузер) кнопки нет — мост молчит,
 * а «Назад» рисует шапка экрана (BackNavButton).
 */
export function BackButtonBridge() {
  const { canGoBack, goBack } = useGoBack();

  // Монтируем кнопку один раз за время жизни приложения.
  useEffect(() => {
    if (backButton.mount.isAvailable()) backButton.mount();
    return () => {
      if (backButton.isMounted()) backButton.unmount();
    };
  }, []);

  // Подписка на нажатие пересоздаётся вместе с goBack: в замыкании актуальные путь и state.returnTo.
  useEffect(() => {
    if (!backButton.onClick.isAvailable()) return;
    return backButton.onClick(goBack);
  }, [goBack]);

  // Показ/скрытие в зависимости от текущего маршрута.
  useEffect(() => {
    if (!backButton.isMounted()) return;
    if (canGoBack) {
      if (backButton.show.isAvailable()) backButton.show();
    } else if (backButton.hide.isAvailable()) {
      backButton.hide();
    }
  }, [canGoBack]);

  return null;
}
