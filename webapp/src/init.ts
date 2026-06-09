import { init, initData, miniApp, themeParams, viewport } from "@telegram-apps/sdk-react";

/**
 * Инициализация Telegram Mini App SDK.
 *
 * Каждый шаг обёрнут защитой: вне Telegram (обычный браузер при разработке) часть
 * компонентов недоступна — тогда просто пропускаем их, не роняя приложение.
 * bindCssVars прокидывает тему Telegram в CSS-переменные, чтобы UI совпадал с клиентом.
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
    themeParams.bindCssVars();
  }

  if (miniApp.mountSync.isAvailable()) {
    miniApp.mountSync();
    miniApp.bindCssVars();
  }

  if (viewport.mount.isAvailable()) {
    viewport
      .mount()
      .then(() => {
        viewport.bindCssVars();
        // Full Screen (Mini Apps v8.0+): доступен не во всех клиентах (например, на десктопе нет),
        // потому гейтим через isAvailable и тихо игнорируем отказ — приложение работает и без него.
        if (viewport.requestFullscreen.isAvailable()) {
          viewport.requestFullscreen().catch(() => {});
        }
      })
      .catch(() => {});
  }
}
