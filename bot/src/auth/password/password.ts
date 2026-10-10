import { randomBytes, scrypt, type ScryptOptions, timingSafeEqual } from "node:crypto";

// scrypt из node:crypto: стойкий к перебору на GPU (memory-hard) и без нативных зависимостей в
// Docker-образе (в отличие от argon2/bcrypt). N=2^15, r=8 → ~32 МБ памяти и десятки мс на хэш.
const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_BYTES = 32;
const SALT_BYTES = 16;
// Node по умолчанию ограничивает scrypt 32 МБ — ровно столько требует N=2^15, r=8; даём запас.
const MAX_MEM = 64 * 1024 * 1024;

function derive(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_BYTES, { ...options, maxmem: MAX_MEM }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

/**
 * Хэш пароля для users.password_hash: "scrypt$N$r$p$salt$hash" (base64). Параметры хранятся в
 * строке — их можно усилить позже, старые хэши продолжат сверяться со своими параметрами.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, { N, r: R, p: P });
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

/** Сверяет пароль с хэшем; false и на неверный пароль, и на нераспознанный формат хэша. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const key = await derive(password, Buffer.from(salt, "base64"), { N: Number(n), r: Number(r), p: Number(p) });
  // Сравнение за постоянное время — время ответа не подсказывает, сколько байт совпало.
  return key.length === expected.length && timingSafeEqual(key, expected);
}
