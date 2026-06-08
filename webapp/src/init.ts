import { init, miniApp, themeParams, viewport } from "@telegram-apps/sdk-react";

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

  if (themeParams.mountSync.isAvailable()) {
    themeParams.mountSync();
    themeParams.bindCssVars();
  }

  if (miniApp.mountSync.isAvailable()) {
    miniApp.mountSync();
    miniApp.bindCssVars();
  }

  if (viewport.mount.isAvailable()) {
    viewport.mount().then(() => viewport.bindCssVars()).catch(() => {});
  }
}
