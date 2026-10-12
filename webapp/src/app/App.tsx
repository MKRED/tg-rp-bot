import { MantineProvider } from "@mantine/core";
import { MotionConfig } from "framer-motion";
import { useMemo } from "react";
import { HashRouter } from "react-router-dom";
import { AuthGate } from "../features/auth";
import { useTelegramChrome } from "../shared/telegram/useTelegramChrome";
import { buildCssVariablesResolver, buildTheme, FONT_PAIRS, PALETTES, ThemeProvider, useTheme } from "../shared/theme";
import { ToastProvider } from "../shared/toast";
import { AnimatedRoutes } from "./AnimatedRoutes";
import { BackButtonBridge } from "./BackButtonBridge";

/** Корень приложения. ThemeProvider снаружи — MantineProvider берёт из него схему, палитру и шрифты. */
export function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}

/**
 * MantineProvider со схемой из ThemeProvider (авто — по теме Telegram, либо ручной выбор);
 * HashRouter держит маршрут в hash URL (переживает reload, оставляет задел под deep-link через start_param).
 */
function AppInner() {
  const { appearance, palette, fontPair, surfaces } = useTheme();
  // Палитру и шрифты пользователь меняет в настройках — тема Mantine пересобирается без перезагрузки.
  const theme = useMemo(() => buildTheme(PALETTES[palette], FONT_PAIRS[fontPair]), [palette, fontPair]);
  const cssVariablesResolver = useMemo(() => buildCssVariablesResolver(PALETTES[palette].surfaces), [palette]);
  // Шапка и фон Telegram — в цвет страницы: все экраны красятся одной палитрой.
  useTelegramChrome(surfaces[appearance].page);
  return (
    // Порталы Mantine (Modal, Drawer, Select, тосты) уходят в body и берут тему из контекста.
    <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} forceColorScheme={appearance}>
      {/* reducedMotion="user" — системное «уменьшить движение» отключает анимации framer-motion. */}
      <MotionConfig reducedMotion="user">
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
      </MotionConfig>
    </MantineProvider>
  );
}
