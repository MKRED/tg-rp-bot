import { createHash, randomBytes } from "node:crypto";

/** Новый токен сессии: 32 случайных байта (base64url) — уходит только в cookie. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 токена — то, что хранится в user_sessions.token_hash (утечка таблицы не даёт войти). */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
