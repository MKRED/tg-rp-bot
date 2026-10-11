import { Button, Stack, Text, Title } from "@mantine/core";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { ROUTES } from "../../../app/routes";
import { ApiError } from "../../../shared/api/client";
import { onUnauthorized } from "../../../shared/api/unauthorized";
import { AppPage } from "../../../shared/components/AppPage";
import { isInsideTelegram } from "../../../shared/telegram/initData";
import { fetchSession, logout as logoutRequest } from "../api/auth-api";
import { AuthContext, type AuthContextValue } from "../lib/authContext";
import { FROM_PARAM, loginPath, safeReturnPath } from "../lib/returnPath";
import type { AuthSession } from "../types/auth";
import { LoginScreen } from "./LoginScreen";

type GateState =
  | { kind: "loading" }
  // returnHere — после входа вернуть на текущий маршрут (сессии не было или она истекла); после «Выйти» — нет.
  | { kind: "anonymous"; returnHere: boolean }
  | { kind: "error"; message: string }
  | { kind: "ready"; session: AuthSession | null };

/**
 * Вход в приложение. В Telegram — сразу приложение (вход по initData, сервер проверяет каждый запрос).
 * В браузере — проверка cookie сессии (GET /api/auth/session): есть — приложение, нет — редирект на
 * экран входа /login?from=<текущий маршрут>; после входа — обратно на from. 401 от любого запроса
 * позже (сессия истекла) тоже уводит на вход с возвратом.
 *
 * Стоит внутри роутера, но над маршрутами: /login рендерит сам gate (в AnimatedRoutes его нет — там
 * catch-all увёл бы на главную и потерял from), а защищённые экраны без сессии не монтируются вовсе.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const telegram = isInsideTelegram();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<GateState>(() =>
    telegram ? { kind: "ready", session: null } : { kind: "loading" },
  );

  const loadSession = useCallback(() => {
    setState({ kind: "loading" });
    fetchSession()
      .then((session) => setState({ kind: "ready", session }))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) setState({ kind: "anonymous", returnHere: true });
        else setState({ kind: "error", message: err instanceof Error ? err.message : "Не удалось загрузить сессию" });
      });
  }, []);

  useEffect(() => {
    if (telegram) return;
    loadSession();
    // Неверный пароль на экране входа — тоже 401: уже анонимны, состояние не трогаем.
    return onUnauthorized(() =>
      setState((prev) => (prev.kind === "anonymous" ? prev : { kind: "anonymous", returnHere: true })),
    );
  }, [telegram, loadSession]);

  const logout = useCallback(async () => {
    await logoutRequest();
    setState({ kind: "anonymous", returnHere: false });
  }, []);

  const value = useMemo<AuthContextValue | null>(
    () =>
      state.kind === "ready"
        ? { mode: telegram ? "telegram" : "browser", session: state.session, logout }
        : null,
    [state, telegram, logout],
  );

  const onLoginRoute = location.pathname === ROUTES.login;

  if (state.kind === "loading") return <AppPage loading centered />;
  if (state.kind === "error") {
    return (
      <AppPage centered>
        <Stack align="center" ta="center">
          <Title order={3}>Сервер недоступен</Title>
          <Text c="dimmed">{state.message}</Text>
          <Button onClick={loadSession}>Повторить</Button>
        </Stack>
      </AppPage>
    );
  }
  if (state.kind === "anonymous") {
    if (onLoginRoute) return <LoginScreen onAuthenticated={loadSession} />;
    return <Navigate to={loginPath(state.returnHere ? location.pathname + location.search : undefined)} replace />;
  }
  // Вошли (или Telegram, или открыли /login уже с сессией) — уходим с экрана входа туда, откуда на него попали.
  if (onLoginRoute) return <Navigate to={safeReturnPath(searchParams.get(FROM_PARAM))} replace />;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
