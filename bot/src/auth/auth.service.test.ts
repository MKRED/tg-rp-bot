import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

vi.mock("../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("../db/index.js", () => ({ db: {}, schema: {} }));

const { AuthService } = await import("./auth.service.js");
const { hashPassword, verifyPassword } = await import("./password/password.js");
type Users = ConstructorParameters<typeof AuthService>[0];
type Sessions = ConstructorParameters<typeof AuthService>[1];

function setup() {
  const users = { createWithLogin: vi.fn(), findLoginCredentials: vi.fn(), findProfile: vi.fn() };
  const sessions = { create: vi.fn().mockResolvedValue("token-1"), revoke: vi.fn().mockResolvedValue(undefined) };
  return { users, sessions, service: new AuthService(users as unknown as Users, sessions as unknown as Sessions) };
}

const creds = { login: "alice", password: "secret-123" };

describe("AuthService.register", () => {
  it("создаёт пользователя с хэшем пароля (не самим паролем) и сразу сессию", async () => {
    const { users, sessions, service } = setup();
    users.createWithLogin.mockResolvedValue("u1");
    await expect(service.register(creds, "UA")).resolves.toBe("token-1");
    const [login, hash] = users.createWithLogin.mock.calls[0]!;
    expect(login).toBe("alice");
    expect(hash).not.toContain("secret-123");
    expect(await verifyPassword("secret-123", hash as string)).toBe(true);
    expect(sessions.create).toHaveBeenCalledWith("u1", "UA");
  });

  it("логин занят — 409 login_taken, сессия не создаётся", async () => {
    const { users, sessions, service } = setup();
    users.createWithLogin.mockResolvedValue(null);
    const err = await service.register(creds, null).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toMatchObject({ error: "login_taken" });
    expect(sessions.create).not.toHaveBeenCalled();
  });
});

describe("AuthService.login", () => {
  it("верный пароль — сессия", async () => {
    const { users, sessions, service } = setup();
    users.findLoginCredentials.mockResolvedValue({ id: "u1", passwordHash: await hashPassword("secret-123") });
    await expect(service.login(creds, null)).resolves.toBe("token-1");
    expect(sessions.create).toHaveBeenCalledWith("u1", null);
  });

  it("неверный пароль и несуществующий логин — одинаковый 401 invalid_credentials", async () => {
    const { users, sessions, service } = setup();
    users.findLoginCredentials.mockResolvedValueOnce({ id: "u1", passwordHash: await hashPassword("other-pass") });
    users.findLoginCredentials.mockResolvedValueOnce(undefined);
    const wrong = await service.login(creds, null).catch((e: unknown) => e);
    const missing = await service.login(creds, null).catch((e: unknown) => e);
    for (const err of [wrong, missing]) {
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect((err as UnauthorizedException).getResponse()).toEqual({ error: "invalid_credentials", message: "Неверный логин или пароль" });
    }
    expect(sessions.create).not.toHaveBeenCalled();
  });
});

describe("AuthService.session / logout", () => {
  it("displayName: имя из Telegram, иначе логин", async () => {
    const { users, service } = setup();
    users.findProfile.mockResolvedValueOnce({ login: null, telegramId: 42, firstName: "Аня", lastName: "К" });
    users.findProfile.mockResolvedValueOnce({ login: "alice", telegramId: null, firstName: null, lastName: null });
    await expect(service.session("u1")).resolves.toEqual({ id: "u1", login: null, telegramLinked: true, displayName: "Аня К" });
    await expect(service.session("u2")).resolves.toEqual({ id: "u2", login: "alice", telegramLinked: false, displayName: "alice" });
  });

  it("logout без cookie ничего не делает, с cookie — отзывает сессию", async () => {
    const { sessions, service } = setup();
    await service.logout(undefined);
    expect(sessions.revoke).not.toHaveBeenCalled();
    await service.logout("t");
    expect(sessions.revoke).toHaveBeenCalledWith("t");
  });
});
