import { AppRoot } from "@telegram-apps/telegram-ui";
import { HashRouter } from "react-router-dom";
import { getPlatform } from "../shared/telegram/platform";
import { ThemeProvider, useTheme } from "../shared/theme";
import { ToastProvider } from "../shared/toast";
import { AnimatedRoutes } from "./AnimatedRoutes";
import { BackButtonBridge } from "./BackButtonBridge";

// Платформа сессии не меняется — маппим в стиль telegram-ui один раз.
// Маки/айфоны → "ios" (iOS-оформление), всё прочее (включая dev-браузер) → "base".
const rawPlatform = getPlatform();
const platform: "ios" | "base" =
  rawPlatform === "ios" || rawPlatform === "macos" ? "ios" : "base";

/**
 * Корень приложения. ThemeProvider стоит СНАРУЖИ AppRoot — он же оборачивает вложенный
 * AppRoot в PromptEditorOverlay (через портал), поэтому оба видят один resolved appearance.
 */
export function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}

/**
 * AppRoot из telegram-ui подставляет тему/платформу; HashRouter держит маршрут в hash URL
 * (переживает reload, оставляет задел под deep-link через start_param).
 *
 * appearance/platform задаём ЯВНО. Иначе telegram-ui (useAppearance) читает legacy-глобал
 * window.Telegram.WebApp, которого у @telegram-apps/sdk-react нет, и сваливается на ОС-ную
 * matchMedia(prefers-color-scheme). Последствия на тёмной теме: на ПК со светлой ОС — белый
 * hover у кнопок; при сворачивании/разворачивании окна — мигание фона (AppRoot терял
 * dark-класс). appearance из useTheme() (дефолт — miniApp.isDark, с учётом ручного оверрайда
 * пользователя) убирает оба.
 */
function AppInner() {
  const { appearance } = useTheme();
  return (
    <AppRoot appearance={appearance} platform={platform}>
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
