/** Вход в приложение: gate над маршрутами (Telegram — initData, браузер — экран /login с возвратом) и его состояние. */
export { AuthGate } from "./components/AuthGate";
export { BrowserLoginSection } from "./components/BrowserLoginSection";
export { useAuth } from "./hooks/useAuth";
export { useBrowserLogin } from "./hooks/useBrowserLogin";
export type { AuthMode, AuthSession } from "./types/auth";
