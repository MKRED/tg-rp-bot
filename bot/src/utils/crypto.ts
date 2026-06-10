import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const VERSION_PREFIX = "v1:";

/**
 * Вторая часть ключа, зашитая в коде.
 * Финальный ключ = HKDF(envKey, CODE_SALT) — для расшифровки нужны оба источника.
 * Утечка только env-переменной или только исходников отдельно не даёт расшифровать данные.
 */
const CODE_SALT = Buffer.from(
  "ef81d0680ad85111aaab63f0d98357b4ee96c74a11f9a10188e0f3332d1f9678",
  "hex",
);

/**
 * Шифрует строку алгоритмом AES-256-GCM.
 * Возвращает: "v1:" + base64(iv[12] || tag[16] || ciphertext).
 * Каждый вызов генерирует новый случайный IV — одинаковый plaintext даёт разные токены.
 */
export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, ciphertext]);
  return VERSION_PREFIX + payload.toString("base64");
}

/**
 * Расшифровывает токен, созданный encrypt().
 * Бросает при подделке данных, неверном ключе или неизвестной версии.
 */
export function decrypt(token: string, key: Buffer): string {
  if (!token.startsWith(VERSION_PREFIX)) {
    throw new Error(`Неизвестная версия шифрования: ${token.slice(0, 8)}`);
  }
  const payload = Buffer.from(token.slice(VERSION_PREFIX.length), "base64");
  const iv = payload.subarray(0, IV_BYTES);
  const tag = payload.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = payload.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}

/**
 * Читает ENCRYPTION_KEY из env, выводит финальный ключ через HKDF(envKey, CODE_SALT).
 * Возвращает undefined, если переменная не задана.
 * Бросает, если задана с неверной длиной.
 */
export function getEncryptionKey(): Buffer | undefined {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) return undefined;
  const envKey = Buffer.from(raw, "hex");
  if (envKey.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY должна быть 64-символьной hex-строкой (32 байта), получено ${envKey.length} байт`,
    );
  }
  // HKDF комбинирует env-ключ и code-salt в один 32-байтный ключ для AES
  return Buffer.from(hkdfSync("sha256", envKey, CODE_SALT, "tg-rp-bot-encryption-v1", 32));
}
