import { miniApp } from "@telegram-apps/sdk-react";
import { useLayoutEffect } from "react";

/**
 * Красит шапку и фон Telegram в цвет страницы (#rrggbb) — иначе над нашей палитрой
 * висит шапка цвета темы клиента. Пока tgui и Mantine живут рядом, вызывается только экранами на
 * Mantine (AppPage) и на размонтировании возвращает цвета темы Telegram — экраны на tgui красятся
 * темой клиента. После удаления tgui — переедет в корень приложения без возврата.
 */
export function useTelegramChrome(color: string): void {
  useLayoutEffect(() => {
    paint(color);
    return () => paint("bg_color");
  }, [color]);
}

// Нижнюю панель (setBottomBarColor) не трогаем: MainButton/SecondaryButton в приложении нет.
function paint(color: string): void {
  // Вне Telegram и в старых клиентах методы недоступны — тогда просто ничего не делаем.
  try {
    if (miniApp.setHeaderColor.isAvailable()) miniApp.setHeaderColor(color);
    if (miniApp.setBackgroundColor.isAvailable()) miniApp.setBackgroundColor(color);
  } catch (err) {
    console.warn("Не удалось покрасить шапку/фон Telegram", err);
  }
}
