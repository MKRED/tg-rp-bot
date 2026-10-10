import { Button, Placeholder, Spinner } from "@telegram-apps/telegram-ui";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "../../../shared/api/client";
import { onUnauthorized } from "../../../shared/api/unauthorized";
import { isInsideTelegram } from "../../../shared/telegram/initData";
import { fetchSession, logout as logoutRequest } from "../api/auth-api";
import { AuthContext, type AuthContextValue } from "../lib/authContext";
import type { AuthSession } from "../types/auth";
import { AuthScreen } from "./AuthScreen";
import "./AuthScreen.css";

type GateState =
  | { kind: "loading" }
  | { kind: "anonymous" }
  | { kind: "error"; message: string }
  | { kind: "ready"; session: AuthSession | null };

/**
 * Вход в приложение. В Telegram — сразу приложение (вход по initData, сервер проверяет каждый запрос).
 * В браузере — проверка cookie сессии (GET /api/auth/session): есть — приложение, нет — экран входа
 * и регистрации. 401 от любого запроса позже (сессия истекла) возвращает на экран входа.
 *
 * Стоит над роутером: экран входа не маршрут, после входа пользователь остаётся на том же hash-пути.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const telegram = isInsideTelegram();
  const [state, setState] = useState<GateState>(() =>
    telegram ? { kind: "ready", session: null } : { kind: "loading" },
  );

  const loadSession = useCallback(() => {
    setState({ kind: "loading" });
    fetchSession()
      .then((session) => setState({ kind: "ready", session }))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) setState({ kind: "anonymous" });
        else setState({ kind: "error", message: err instanceof Error ? err.message : "Не удалось загрузить сессию" });
      });
  }, []);

  useEffect(() => {
    if (telegram) return;
    loadSession();
    return onUnauthorized(() => setState({ kind: "anonymous" }));
  }, [telegram, loadSession]);

  const logout = useCallback(async () => {
    await logoutRequest();
    setState({ kind: "anonymous" });
  }, []);

  const value = useMemo<AuthContextValue | null>(
    () =>
      state.kind === "ready"
        ? { mode: telegram ? "telegram" : "browser", session: state.session, logout }
        : null,
    [state, telegram, logout],
  );

  if (state.kind === "loading") {
    return (
      <div className="auth-screen">
        <Spinner size="l" />
      </div>
    );
  }
  if (state.kind === "anonymous") return <AuthScreen onAuthenticated={loadSession} />;
  if (state.kind === "error") {
    return (
      <div className="auth-screen">
        <Placeholder
          header="Сервер недоступен"
          description={state.message}
          action={
            <Button size="m" onClick={loadSession}>
              Повторить
            </Button>
          }
        />
      </div>
    );
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
