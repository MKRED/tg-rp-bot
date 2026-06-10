import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "./crypto.js";

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
    // Портим последние 2 символа base64 — меняем ciphertext
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
