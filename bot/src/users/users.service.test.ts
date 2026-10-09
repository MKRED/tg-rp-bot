import { describe, expect, it, vi } from "vitest";

const ensureUser = vi.fn();
vi.mock("../db/users.js", () => ({ ensureUser }));

const { UsersService } = await import("./users.service.js");

const user = { id: 42, first_name: "Alice" };

describe("UsersService.ensureTelegramUser", () => {
  it("upsert один раз на процесс для одного пользователя", async () => {
    ensureUser.mockReset().mockResolvedValue(undefined);
    const service = new UsersService();
    await service.ensureTelegramUser(user);
    await service.ensureTelegramUser(user);
    expect(ensureUser).toHaveBeenCalledTimes(1);
  });

  it("после неудачного upsert следующий вызов пробует снова", async () => {
    ensureUser.mockReset().mockRejectedValueOnce(new Error("db down")).mockResolvedValue(undefined);
    const service = new UsersService();
    await expect(service.ensureTelegramUser(user)).rejects.toThrow("db down");
    await service.ensureTelegramUser(user);
    expect(ensureUser).toHaveBeenCalledTimes(2);
  });
});
