import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decrypt, decryptField, encrypt, encryptField, getUserEncryptionKey } from "./crypto.js";

const KEY = randomBytes(32);

describe("encrypt / decrypt", () => {
  it("round-trip: расшифровывает то, что зашифровал", () => {
    const plain = "Привет, мир! 🔐";
    expect(decrypt(encrypt(plain, KEY), KEY)).toBe(plain);
  });

  it("каждый encrypt даёт уникальный токен (случайный IV)", () => {
    const plain = "test";
    expect(encrypt(plain, KEY)).not.toBe(encrypt(plain, KEY));
  });

  it("decrypt бросает при изменённых данных (tamper)", () => {
    const token = encrypt("secret", KEY);
    const tampered = token.slice(0, -2) + (token.endsWith("AA") ? "BB" : "AA");
    expect(() => decrypt(tampered, KEY)).toThrow();
  });

  it("decrypt бросает при неверном ключе", () => {
    const token = encrypt("secret", KEY);
    const wrongKey = randomBytes(32);
    expect(() => decrypt(token, wrongKey)).toThrow();
  });

  it("decrypt бросает при неизвестной версии", () => {
    expect(() => decrypt("v2:abc123", KEY)).toThrow("Неизвестная версия шифрования");
  });

  it("шифрует пустую строку", () => {
    expect(decrypt(encrypt("", KEY), KEY)).toBe("");
  });

  it("шифрует длинный текст (промпт)", () => {
    const long = "А".repeat(5000);
    expect(decrypt(encrypt(long, KEY), KEY)).toBe(long);
  });
});

describe("getUserEncryptionKey", () => {
  const TEST_KEY = randomBytes(32).toString("hex");

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  it("одинаковый userId → одинаковый ключ (детерминированность)", () => {
    const k1 = getUserEncryptionKey(42);
    const k2 = getUserEncryptionKey(42);
    expect(k1.equals(k2)).toBe(true);
  });

  it("разные userId → разные ключи", () => {
    const k1 = getUserEncryptionKey(1);
    const k2 = getUserEncryptionKey(2);
    expect(k1.equals(k2)).toBe(false);
  });

  it("ключ пользователя A не расшифровывает данные пользователя B", () => {
    const keyA = getUserEncryptionKey(1);
    const keyB = getUserEncryptionKey(2);
    const token = encrypt("секрет", keyA);
    expect(() => decrypt(token, keyB)).toThrow();
  });

  it("round-trip с пользовательским ключом", () => {
    const key = getUserEncryptionKey(123);
    const plain = "промпт персонажа";
    expect(decrypt(encrypt(plain, key), key)).toBe(plain);
  });
});

describe("encryptField / decryptField", () => {
  it("null проходит насквозь", () => {
    expect(encryptField(null, KEY)).toBeNull();
    expect(decryptField(null, KEY)).toBeNull();
  });

  it("round-trip через field-хелперы", () => {
    const plain = "промпт персонажа";
    expect(decryptField(encryptField(plain, KEY), KEY)).toBe(plain);
  });

  it("decryptField возвращает legacy plaintext как есть", () => {
    const legacy = "старый незашифрованный промпт";
    expect(decryptField(legacy, KEY)).toBe(legacy);
  });

  it("encryptField шифрует пустую строку", () => {
    const token = encryptField("", KEY);
    expect(token).toMatch(/^v1:/);
    expect(decryptField(token, KEY)).toBe("");
  });
});
