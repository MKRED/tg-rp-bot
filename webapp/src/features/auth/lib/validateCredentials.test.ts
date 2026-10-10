import { describe, expect, it } from "vitest";
import { normalizeLogin, validateCredentials } from "./validateCredentials";

describe("validateCredentials", () => {
  it("вход: нужны только непустые логин и пароль", () => {
    expect(validateCredentials("login", { login: " ", password: "x" })).toBe("Введите логин");
    expect(validateCredentials("login", { login: "a", password: "" })).toBe("Введите пароль");
    expect(validateCredentials("login", { login: "a", password: "x" })).toBeNull();
  });

  it("регистрация: формат логина, длина пароля, совпадение повтора", () => {
    const ok = { login: "Alice_1", password: "12345678", repeat: "12345678" };
    expect(validateCredentials("register", ok)).toBeNull();
    expect(validateCredentials("register", { ...ok, login: "алиса" })).toMatch(/^Логин/);
    expect(validateCredentials("register", { ...ok, login: "ab" })).toMatch(/^Логин/);
    expect(validateCredentials("register", { ...ok, password: "1234567", repeat: "1234567" })).toMatch(/^Пароль/);
    expect(validateCredentials("register", { ...ok, repeat: "87654321" })).toBe("Пароли не совпадают");
  });

  it("логин нормализуется как на сервере", () => {
    expect(normalizeLogin("  Alice.B ")).toBe("alice.b");
  });
});
