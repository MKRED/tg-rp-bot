import { createHash, randomBytes } from "node:crypto";

/** Префикс токена агента: по нему токен легко узнать в логах и конфигах, если его случайно вставят не туда. */
const TOKEN_PREFIX = "cagt_";

/** Новый токен агента: 256 бит случайности, перебор невозможен — поэтому хеш без соли. */
export function generateAgentToken(): string {
  return TOKEN_PREFIX + randomBytes(32).toString("base64url");
}

/** SHA-256 (hex) токена — только он хранится в БД. */
export function hashAgentToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Токен из заголовка `Authorization: Bearer cagt_…`; null — заголовка нет или формат чужой. */
export function parseAgentBearer(header: string | undefined): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(header?.trim() ?? "");
  const token = match?.[1];
  return token?.startsWith(TOKEN_PREFIX) ? token : null;
}
