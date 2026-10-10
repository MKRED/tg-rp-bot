import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const DATA_KEY_BYTES = 32;

/**
 * Префикс зашифрованного поля данных. v2 — шифрование случайным ключом пользователя
 * (users.data_key). v1 (ключ из Telegram id) остался только в истории: всё перешифровано
 * скриптом src/scripts/migrate-user-keys, и новый код v1 не читает.
 */
const DATA_PREFIX = "v2:";
/** Префикс ключа пользователя, зашифрованного мастер-ключом (users.data_key). */
const DATA_KEY_PREFIX = "k1:";

/**
 * Вторая часть ключа, зашитая в коде.
 * Финальный ключ = HKDF(envKey, CODE_SALT) — для расшифровки нужны оба источника.
 * Утечка только env-переменной или только исходников отдельно не даёт расшифровать данные.
 */
const CODE_SALT = Buffer.from(
  "ef81d0680ad85111aaab63f0d98357b4ee96c74a11f9a10188e0f3332d1f9678",
  "hex",
);

/** AES-256-GCM: prefix + base64(iv[12] || tag[16] || ciphertext), каждый вызов — новый случайный IV. */
function seal(plaintext: Buffer, key: Buffer, prefix: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return prefix + Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

/** Обратное seal(); бросает при другом префиксе, подделке данных или неверном ключе. */
function open(token: string, key: Buffer, prefix: string): Buffer {
  if (!token.startsWith(prefix)) {
    throw new Error(`Неизвестная версия шифрования: ${token.slice(0, 8)}`);
  }
  const payload = Buffer.from(token.slice(prefix.length), "base64");
  const iv = payload.subarray(0, IV_BYTES);
  const tag = payload.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = payload.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/** Шифрует строку ключом пользователя: "v2:" + base64(iv || tag || ciphertext). */
export function encrypt(plaintext: string, key: Buffer): string {
  return seal(Buffer.from(plaintext, "utf8"), key, DATA_PREFIX);
}

/** Расшифровывает токен, созданный encrypt(). Бросает при подделке, неверном ключе или чужой версии. */
export function decrypt(token: string, key: Buffer): string {
  return open(token, key, DATA_PREFIX).toString("utf8");
}

/**
 * Шифрует строку, null → null.
 * Перегрузки сохраняют точный тип: string → string, string|null → string|null.
 */
export function encryptField(value: string, key: Buffer): string;
export function encryptField(value: string | null, key: Buffer): string | null;
export function encryptField(value: string | null, key: Buffer): string | null {
  if (value === null || value === undefined) return null;
  return encrypt(value, key);
}

/**
 * Расшифровывает поле из БД. null → null, пустая строка → пустая строка (DB default у части
 * колонок — '' без шифрования).
 *
 * Всё остальное без префикса v2 — ошибка, а не «старый открытый текст как есть»: иначе
 * шифротекст другой версии (или недоперешифрованный) молча ушёл бы в UI как контент и мог быть
 * сохранён обратно уже как «текст».
 */
export function decryptField(value: string, key: Buffer): string;
export function decryptField(value: string | null, key: Buffer): string | null;
export function decryptField(value: string | null, key: Buffer): string | null {
  if (value === null || value === undefined) return null;
  if (value === "") return "";
  return decrypt(value, key);
}

/**
 * Читает ENCRYPTION_KEY из env, выводит мастер-ключ через HKDF(envKey, CODE_SALT).
 * Бросает, если переменная не задана или имеет неверную длину.
 */
export function getEncryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("ENCRYPTION_KEY не задана — необходима для работы с зашифрованными полями");
  }
  const envKey = Buffer.from(raw, "hex");
  if (envKey.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY должна быть 64-символьной hex-строкой (32 байта), получено ${envKey.length} байт`,
    );
  }
  // HKDF комбинирует env-ключ и code-salt в один 32-байтный мастер-ключ
  return Buffer.from(hkdfSync("sha256", envKey, CODE_SALT, "tg-rp-bot-encryption-v1", 32));
}

/**
 * Новый случайный ключ пользователя и он же, зашифрованный мастер-ключом, — для users.data_key.
 * Ключ не выводится ни из каких id: id пользователя и способ входа можно менять, не трогая данные,
 * а смена мастер-ключа перешифровывает только по одному полю на пользователя.
 */
export function generateDataKey(): { key: Buffer; wrapped: string } {
  const key = randomBytes(DATA_KEY_BYTES);
  return { key, wrapped: seal(key, getEncryptionKey(), DATA_KEY_PREFIX) };
}

/** Расшифровывает users.data_key мастер-ключом. Бросает при чужом мастер-ключе или подделке. */
export function unwrapDataKey(wrapped: string): Buffer {
  const key = open(wrapped, getEncryptionKey(), DATA_KEY_PREFIX);
  if (key.length !== DATA_KEY_BYTES) throw new Error(`Ключ пользователя неверной длины: ${key.length} байт`);
  return key;
}

/**
 * Расшифровывает значения кэша переводов сообщения RP-чата или истории (ключи — коды языков —
 * остаются открытыми). null → null.
 */
export function decryptTranslations(
  translations: Record<string, string> | null,
  key: Buffer,
): Record<string, string> | null {
  if (!translations) return null;
  const out: Record<string, string> = {};
  for (const [lang, text] of Object.entries(translations)) {
    out[lang] = decryptField(text, key);
  }
  return out;
}
