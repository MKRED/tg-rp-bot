import { initData } from "@telegram-apps/sdk-react";

/**
 * Граница webapp → серверное API бота (/api/*).
 *
 * Каждый запрос несёт подписанную Telegram строку initData в заголовке
 * `Authorization: tma <initData>` — сервер проверяет её подпись (см. bot/src/server/middleware/initData.ts)
 * и только тогда доверяет пользователю. Персональный ключ DeepSeek живёт ТОЛЬКО на сервере
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

/** Заголовок Authorization — нужен для ручного fetch (SSE-поток). */
export function getAuthHeader(): string {
  const raw = initData.raw();
  return raw ? `tma ${raw}` : "";
}

/** Типизированный fetch к /api/* с автоматической подстановкой initData. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const raw = initData.raw();
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  // Вне Telegram raw отсутствует — отправляем без заголовка (сервер сам решает: в dev пропустит).
  if (raw) headers.set("Authorization", `tma ${raw}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
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
