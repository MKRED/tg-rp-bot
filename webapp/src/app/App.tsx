import { MantineProvider } from "@mantine/core";
import { AppRoot } from "@telegram-apps/telegram-ui";
import { MotionConfig } from "framer-motion";
import { useMemo } from "react";
import { HashRouter } from "react-router-dom";
import { AuthGate } from "../features/auth";
import { getPlatform } from "../shared/telegram/platform";
import { buildCssVariablesResolver, buildTheme, FONT_PAIRS, PALETTES, ThemeProvider, useTheme } from "../shared/theme";
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
 * dark-класс). appearance из useTheme() (дефолт — themeParams.isDark, с учётом ручного оверрайда
 * пользователя) убирает оба.
 */
function AppInner() {
  const { appearance, palette, fontPair } = useTheme();
  // Палитру и шрифты пользователь меняет в настройках — тема Mantine пересобирается без перезагрузки.
  const theme = useMemo(() => buildTheme(PALETTES[palette], FONT_PAIRS[fontPair]), [palette, fontPair]);
  const cssVariablesResolver = useMemo(() => buildCssVariablesResolver(PALETTES[palette].surfaces), [palette]);
  return (
    // Mantine — снаружи AppRoot: её порталы (Modal, Drawer, Select, тосты) уходят в body и берут
    // тему из контекста. Схема одна на обе библиотеки — appearance из ThemeProvider.
    <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} forceColorScheme={appearance}>
      {/* reducedMotion="user" — системное «уменьшить движение» отключает анимации framer-motion. */}
      <MotionConfig reducedMotion="user">
        <AppRoot appearance={appearance} platform={platform}>
          {/* ToastProvider оборачивает всё приложение: тосты доступны на любом экране (в т.ч.
              поверх лайтбокса). */}
          <ToastProvider>
            <HashRouter>
              {/* Вход (вне Telegram — редирект на /login и обратно) — внутри роутера, над маршрутами:
                  без сессии защищённые экраны не монтируются. */}
              <AuthGate>
                {/* Мост нативной кнопки «Назад» — внутри роутера, т.к. использует navigate/location. */}
                <BackButtonBridge />
                <AnimatedRoutes />
              </AuthGate>
            </HashRouter>
          </ToastProvider>
        </AppRoot>
      </MotionConfig>
    </MantineProvider>
  );
}
