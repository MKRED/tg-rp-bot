import { AppRoot } from "@telegram-apps/telegram-ui";
import { miniApp, useSignal } from "@telegram-apps/sdk-react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { HomePage } from "../pages/home/HomePage";
import { CharactersListPage } from "../pages/characters/CharactersListPage";
import { CharacterEditPage } from "../pages/characters/CharacterEditPage";
import { PresetsListPage } from "../pages/generation-presets/PresetsListPage";
import { PresetEditPage } from "../pages/generation-presets/PresetEditPage";
import { RpChat } from "../features/rp-chat";
import { getPlatform } from "../shared/telegram/platform";
import { BackButtonBridge } from "./BackButtonBridge";
import { ROUTES } from "./routes";

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
      <HashRouter>
        {/* Мост нативной кнопки «Назад» — внутри роутера, т.к. использует navigate/location. */}
        <BackButtonBridge />
        <Routes>
          <Route path={ROUTES.home} element={<HomePage />} />
          <Route path={ROUTES.chat} element={<RpChat />} />
          <Route path={ROUTES.characters} element={<CharactersListPage />} />
          {/* Статический /characters/new стоит раньше /characters/:id — react-router отдаёт ему приоритет. */}
          <Route path={ROUTES.characterNew} element={<CharacterEditPage />} />
          <Route path={ROUTES.characterEdit} element={<CharacterEditPage />} />
          <Route path={ROUTES.presets} element={<PresetsListPage />} />
          {/* Статический /presets/new стоит раньше /presets/:id — react-router отдаёт ему приоритет. */}
          <Route path={ROUTES.presetNew} element={<PresetEditPage />} />
          <Route path={ROUTES.presetEdit} element={<PresetEditPage />} />
          {/*
            Любой неизвестный путь → главная. Важно для Telegram Web: launch-параметры
            прилетают в hash (#tgWebAppData=…); init() их уже считал, а роутеру этот hash
            маршрутом не является — редирект уводит на главную вместо пустого экрана.
          */}
          <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
        </Routes>
      </HashRouter>
    </AppRoot>
  );
}
