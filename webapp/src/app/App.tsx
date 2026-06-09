import { AppRoot } from "@telegram-apps/telegram-ui";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { HomePage } from "../pages/home/HomePage";
import { RpChat } from "../features/rp-chat/RpChat";
import { BackButtonBridge } from "./BackButtonBridge";
import { ROUTES } from "./routes";

/**
 * Корень приложения.
 * AppRoot из telegram-ui подставляет тему/платформу Telegram; HashRouter держит
 * маршрут в hash URL (переживает reload, оставляет задел под deep-link через start_param).
 */
export function App() {
  return (
    <AppRoot>
      <HashRouter>
        {/* Мост нативной кнопки «Назад» — внутри роутера, т.к. использует navigate/location. */}
        <BackButtonBridge />
        <Routes>
          <Route path={ROUTES.home} element={<HomePage />} />
          <Route path={ROUTES.chat} element={<RpChat />} />
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
