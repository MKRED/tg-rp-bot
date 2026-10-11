import { apiFetch } from "../../../shared/api/client";
import type { AuthCredentials, AuthSession } from "../types/auth";

/** Кто вошёл; 401 (ApiError) — сессии нет. */
export function fetchSession(): Promise<AuthSession> {
  return apiFetch<AuthSession>("/auth/session");
}

export async function register(credentials: AuthCredentials): Promise<void> {
  await apiFetch("/auth/register", { method: "POST", body: JSON.stringify(credentials) });
}

export async function login(credentials: AuthCredentials): Promise<void> {
  await apiFetch("/auth/login", { method: "POST", body: JSON.stringify(credentials) });
}

/** Задать логин и пароль аккаунту из Telegram (только из Mini App, логин задаётся один раз). */
export async function setCredentials(credentials: AuthCredentials): Promise<void> {
  await apiFetch("/auth/credentials", { method: "PUT", body: JSON.stringify(credentials) });
}

export async function logout(): Promise<void> {
  await apiFetch("/auth/logout", { method: "POST" });
}
