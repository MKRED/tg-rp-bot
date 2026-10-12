import { init, initData, miniApp, themeParams, viewport } from "@telegram-apps/sdk-react";
import { isMobilePlatform } from "./shared/telegram/platform";

/**
 * Инициализация Telegram Mini App SDK.
 *
 * Каждый шаг обёрнут защитой: вне Telegram (обычный браузер при разработке) часть
 * компонентов недоступна — тогда просто пропускаем их, не роняя приложение.
 * Тему Telegram в CSS-переменные не прокидываем: цвета даёт палитра Mantine, из themeParams нужен только
 * isDark (ThemeProvider). viewport.bindCssVars — для --tg-viewport-* (safe area в модулях).
 */
export function initTelegram(): void {
  try {
    init();
  } catch (err) {
    console.warn("[tma] init skipped (вероятно, открыто вне Telegram):", err);
    return;
  }

  // Восстанавливаем initData из launch-параметров: после этого доступны
  // initData.user() (имя/аватар для главной) и initData.raw() (для заголовка API).
  initData.restore();

  if (themeParams.mountSync.isAvailable()) {
    themeParams.mountSync();
  }

  if (miniApp.mountSync.isAvailable()) {
    // Нужен для покраски шапки и фона Telegram под палитру (useTelegramChrome).
    miniApp.mountSync();
  }

  if (viewport.mount.isAvailable()) {
    viewport
      .mount()
      .then(() => {
        viewport.bindCssVars();
        // Full Screen (Mini Apps v8.0+) — только на мобильных клиентах: на десктопе метод
        // тоже доступен, но лишь растягивает окно на весь экран, что не нужно. Гейтим
        // и по платформе, и по isAvailable; отказ тихо игнорируем — приложение работает без него.
        if (isMobilePlatform() && viewport.requestFullscreen.isAvailable()) {
          viewport.requestFullscreen().catch(() => {});
        }
      })
      .catch(() => {});
  }
}
