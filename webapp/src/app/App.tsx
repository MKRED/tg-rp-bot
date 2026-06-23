import { AppRoot } from "@telegram-apps/telegram-ui";
import { miniApp, useSignal } from "@telegram-apps/sdk-react";
import { HashRouter } from "react-router-dom";
import { getPlatform } from "../shared/telegram/platform";
import { ToastProvider } from "../shared/toast";
import { AnimatedRoutes } from "./AnimatedRoutes";
import { BackButtonBridge } from "./BackButtonBridge";

// Платформа сессии не меняется — маппим в стиль telegram-ui один раз.
// Маки/айфоны → "ios" (iOS-оформление), всё прочее (включая dev-браузер) → "base".
const rawPlatform = getPlatform();
const platform: "ios" | "base" =
  rawPlatform === "ios" || rawPlatform === "macos" ? "ios" : "base";

/**
 * Корень приложения.
 * AppRoot из telegram-ui подставляет тему/платформу Telegram; HashRouter держит
 * маршрут в hash URL (переживает reload, оставляет задел под deep-link через start_param).
 *
 * appearance/platform задаём ЯВНО из сигналов SDK. Иначе telegram-ui (useAppearance)
 * читает legacy-глобал window.Telegram.WebApp, которого у @telegram-apps/sdk-react нет,
 * и сваливается на ОС-ную matchMedia(prefers-color-scheme). Последствия на тёмной теме:
 * на ПК со светлой ОС — белый hover у кнопок; при сворачивании/разворачивании окна —
 * мигание фона (AppRoot терял dark-класс). Привязка к miniApp.isDark убирает оба.
 */
export function App() {
  const isDark = useSignal(miniApp.isDark);
  return (
    <AppRoot appearance={isDark ? "dark" : "light"} platform={platform}>
      {/* ToastProvider оборачивает всё приложение: тосты доступны на любом экране (в т.ч.
          в порталах — лайтбокс), а Snackbar наследует тему AppRoot. */}
      <ToastProvider>
        <HashRouter>
          {/* Мост нативной кнопки «Назад» — внутри роутера, т.к. использует navigate/location. */}
          <BackButtonBridge />
          <AnimatedRoutes />
        </HashRouter>
      </ToastProvider>
    </AppRoot>
  );
}
