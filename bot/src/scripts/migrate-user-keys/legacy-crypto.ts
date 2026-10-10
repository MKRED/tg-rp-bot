import { createDecipheriv, hkdfSync } from "node:crypto";
import { getEncryptionKey } from "../../utils/index.js";

// Шифрование v1 (до UUID-пользователей): ключ пользователя выводился из его Telegram id. Нужен
// только этому скрипту, чтобы прочитать старые данные; рабочий код v1 не знает.
const LEGACY_PREFIX = "v1:";
const IV_BYTES = 12;
const TAG_BYTES = 16;

export function isLegacyToken(value: string): boolean {
  return value.startsWith(LEGACY_PREFIX);
}

/** Ключ пользователя схемы v1: HKDF(masterKey, ∅, "tg-rp-bot-user-<telegramId>"). */
export function legacyUserKey(telegramId: number): Buffer {
  return Buffer.from(hkdfSync("sha256", getEncryptionKey(), Buffer.alloc(0), `tg-rp-bot-user-${telegramId}`, 32));
}

/** Расшифровывает токен v1; бросает при неверном ключе или подделке (GCM). */
export function decryptLegacy(token: string, key: Buffer): string {
  const payload = Buffer.from(token.slice(LEGACY_PREFIX.length), "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, payload.subarray(0, IV_BYTES));
  decipher.setAuthTag(payload.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
  return decipher.update(payload.subarray(IV_BYTES + TAG_BYTES)) + decipher.final("utf8");
}
