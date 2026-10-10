import { initData } from "@telegram-apps/sdk-react";
import { CSRF_HEADER, CSRF_HEADER_VALUE } from "@tg-rp-bot/shared";
import { notifyUnauthorized } from "./unauthorized";

/**
 * Граница webapp → серверное API бота (/api/*).
 *
 * В Mini App каждый запрос несёт подписанную Telegram строку initData в заголовке
 * `Authorization: tma <initData>` — сервер проверяет её подпись (см. bot/src/auth/initData.ts)
 * и только тогда доверяет пользователю. В обычном браузере вход по логину: сессия в httpOnly-cookie,
 * браузер прикладывает её сам (same-origin), а CSRF_HEADER на каждом запросе доказывает серверу, что
 * запрос шлёт наша страница, а не чужой сайт. Персональный ключ DeepSeek живёт ТОЛЬКО на сервере
 * (зашифрован в БД), поэтому вся RP-генерация/перевод идут через этот слой, а не напрямую из браузера.
 */
const API_BASE = "/api";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Базовый URL API — нужен для ручного fetch (SSE-поток). */
export function getApiBase(): string {
  return API_BASE;
}

/** Заголовки авторизации для любого запроса к /api — нужны и ручному fetch (SSE-поток). */
export function getAuthHeaders(): Record<string, string> {
  const raw = initData.raw();
  return { [CSRF_HEADER]: CSRF_HEADER_VALUE, ...(raw ? { Authorization: `tma ${raw}` } : {}) };
}

/**
 * 401 вне Telegram — сессия истекла или пользователь вышел на другой вкладке: показываем экран входа
 * (AuthGate). В Mini App 401 означает битый initData — экран входа там не поможет.
 */
export function reportAuthFailure(status: number): void {
  if (status === 401 && !initData.raw()) notifyUnauthorized();
}

/** Типизированный fetch к /api/* с автоматической подстановкой заголовков авторизации. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  for (const [name, value] of Object.entries(getAuthHeaders())) headers.set(name, value);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    reportAuthFailure(res.status);
    // Сервер иногда шлёт содержательный текст (например MissingApiKeyError) в теле —
    // используем его, если есть; иначе — прежний общий текст.
    const body = await res.json().catch(() => null);
    const serverMessage =
      body && typeof body === "object" && ("message" in body || "error" in body)
        ? ((body as { message?: unknown; error?: unknown }).message ??
          (body as { message?: unknown; error?: unknown }).error)
        : undefined;
    throw new ApiError(
      res.status,
      typeof serverMessage === "string" ? serverMessage : `API ${path} failed: ${res.status}`,
    );
  }
  return res.json() as Promise<T>;
}
