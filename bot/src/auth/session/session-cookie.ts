import type { CookieOptions, Response } from "express";
import { SESSION_COOKIE, SESSION_TTL_MS } from "./session.constants.js";

/**
 * Значение cookie из заголовка Cookie. Свой разбор вместо cookie-parser: нужна одна cookie в одном
 * месте (guard), а middleware разбирал бы все cookie на каждом запросе.
 */
export function readCookie(header: string | undefined, name: string = SESSION_COOKIE): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    const value = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(value) || undefined;
    } catch {
      return undefined; // битое %-кодирование — считаем, что cookie нет
    }
  }
  return undefined;
}

/**
 * Параметры cookie сессии. HttpOnly — JS страницы токен не видит (XSS его не унесёт); SameSite=Lax —
 * браузер не шлёт cookie с чужих сайтов на POST/PUT/DELETE; Secure — только HTTPS (локально dev идёт
 * по http, поэтому только в проде); path=/api — статике cookie не нужна.
 */
export function sessionCookieOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, secure, sameSite: "lax", path: "/api", maxAge: SESSION_TTL_MS };
}

/** Ставит cookie сессии (вход, регистрация, продление срока). */
export function setSessionCookie(res: Response, token: string, secure: boolean): void {
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions(secure));
}

/** Гасит cookie сессии (выход). Параметры те же, иначе браузер сочтёт это другой cookie. */
export function clearSessionCookie(res: Response, secure: boolean): void {
  const { maxAge: _maxAge, ...options } = sessionCookieOptions(secure);
  res.clearCookie(SESSION_COOKIE, options);
}
