import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decrypt, decryptField, encrypt, encryptField, generateDataKey, unwrapDataKey } from "./crypto.js";

const KEY = randomBytes(32);

describe("encrypt / decrypt", () => {
  it("round-trip: расшифровывает то, что зашифровал", () => {
    const plain = "Привет, мир! 🔐";
    expect(decrypt(encrypt(plain, KEY), KEY)).toBe(plain);
  });

  it("токен в формате v2", () => {
    expect(encrypt("test", KEY)).toMatch(/^v2:/);
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
    expect(() => decrypt(token, randomBytes(32))).toThrow();
  });

  it("decrypt бросает на старой версии v1 и неизвестной версии", () => {
    expect(() => decrypt("v1:abc123", KEY)).toThrow("Неизвестная версия шифрования");
    expect(() => decrypt("v3:abc123", KEY)).toThrow("Неизвестная версия шифрования");
  });

  it("шифрует пустую строку", () => {
    expect(decrypt(encrypt("", KEY), KEY)).toBe("");
  });

  it("шифрует длинный текст (промпт)", () => {
    const long = "А".repeat(5000);
    expect(decrypt(encrypt(long, KEY), KEY)).toBe(long);
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

  it("пустая строка без шифрования (DB default) читается как пустая", () => {
    expect(decryptField("", KEY)).toBe("");
  });

  it("открытый текст и шифротекст v1 — ошибка, а не «как есть»", () => {
    expect(() => decryptField("старый незашифрованный промпт", KEY)).toThrow();
    expect(() => decryptField("v1:AAAA", KEY)).toThrow();
  });
});

describe("generateDataKey / unwrapDataKey", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = randomBytes(32).toString("hex");
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  it("обёрнутый ключ разворачивается в тот же ключ", () => {
    const { key, wrapped } = generateDataKey();
    expect(wrapped).toMatch(/^k1:/);
    expect(unwrapDataKey(wrapped).equals(key)).toBe(true);
  });

  it("каждый пользователь получает свой ключ; чужим ключом данные не расшифровать", () => {
    const a = generateDataKey();
    const b = generateDataKey();
    expect(a.key.equals(b.key)).toBe(false);
    expect(() => decrypt(encrypt("секрет", a.key), b.key)).toThrow();
  });

  it("при другом мастер-ключе обёрнутый ключ не разворачивается", () => {
    const { wrapped } = generateDataKey();
    process.env.ENCRYPTION_KEY = randomBytes(32).toString("hex");
    expect(() => unwrapDataKey(wrapped)).toThrow();
  });

  it("токен данных не принимается как обёрнутый ключ", () => {
    expect(() => unwrapDataKey(encrypt("x", KEY))).toThrow("Неизвестная версия шифрования");
  });
});
