/** Вход в приложение: gate над роутером (Telegram — initData, браузер — логин и пароль) и его состояние. */
export { AuthGate } from "./components/AuthGate";
export { BrowserLoginSection } from "./components/BrowserLoginSection";
export { useAuth } from "./hooks/useAuth";
export { useBrowserLogin } from "./hooks/useBrowserLogin";
export type { AuthMode, AuthSession } from "./types/auth";
