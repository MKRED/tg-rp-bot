import {
  disableVerticalSwipes,
  enableVerticalSwipes,
  isSwipeBehaviorMounted,
  mountSwipeBehavior,
} from "@telegram-apps/sdk-react";

/**
 * Временно выключает сворачивание Mini App свайпом вниз — на время собственного жеста (перетаскивание
 * строки за ручку): иначе Telegram принимает протяжку вниз за «свернуть». Возвращает функцию, которая
 * включает свайпы обратно. Вне Telegram (или в старом клиенте без Bot API 7.7) — ничего не делает.
 */
export function suspendVerticalSwipes(): () => void {
  try {
    if (!isSwipeBehaviorMounted() && mountSwipeBehavior.isAvailable()) mountSwipeBehavior();
    if (!disableVerticalSwipes.isAvailable()) return () => {};
    disableVerticalSwipes();
  } catch (err) {
    console.warn("Не удалось выключить вертикальные свайпы", err);
    return () => {};
  }
  return () => {
    try {
      if (enableVerticalSwipes.isAvailable()) enableVerticalSwipes();
    } catch (err) {
      console.warn("Не удалось вернуть вертикальные свайпы", err);
    }
  };
}
