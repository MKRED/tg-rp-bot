import { initData } from "@telegram-apps/sdk-react";

/**
 * Граница webapp → серверное API бота (/api/*).
 *
 * Каждый запрос несёт подписанную Telegram строку initData в заголовке
 * `Authorization: tma <initData>` — сервер проверяет её подпись (см. bot/src/server/initData.ts)
 * и только тогда доверяет пользователю. Ключ OpenRouter живёт ТОЛЬКО на сервере, поэтому
 * вся RP-генерация/перевод идут через этот слой, а не напрямую из браузера.
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

/** Типизированный fetch к /api/* с автоматической подстановкой initData. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const raw = initData.raw();
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  // Вне Telegram raw отсутствует — отправляем без заголовка (сервер сам решает: в dev пропустит).
  if (raw) headers.set("Authorization", `tma ${raw}`);

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    throw new ApiError(res.status, `API ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}
