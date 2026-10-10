import { describe, expect, it, vi } from "vitest";

vi.mock("../db/index.js", () => ({ db: {}, schema: {} }));
vi.mock("../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const { UsersService } = await import("./users.service.js");
type Repo = ConstructorParameters<typeof UsersService>[0];

const user = { id: 42, first_name: "Alice" };
const setup = () => {
  const repo = { upsertTelegramProfile: vi.fn().mockResolvedValue(undefined) };
  return { repo, service: new UsersService(repo as unknown as Repo) };
};

describe("UsersService.ensureTelegramUser", () => {
  it("upsert один раз на процесс для одного пользователя", async () => {
    const { repo, service } = setup();
    await service.ensureTelegramUser(user);
    await service.ensureTelegramUser(user);
    expect(repo.upsertTelegramProfile).toHaveBeenCalledTimes(1);
  });

  it("после неудачного upsert следующий вызов пробует снова", async () => {
    const { repo, service } = setup();
    repo.upsertTelegramProfile.mockRejectedValueOnce(new Error("db down"));
    await expect(service.ensureTelegramUser(user)).rejects.toThrow("db down");
    await service.ensureTelegramUser(user);
    expect(repo.upsertTelegramProfile).toHaveBeenCalledTimes(2);
  });
});

describe("UsersService.saveTelegramProfile", () => {
  it("/start пишет профиль каждый раз, даже если пользователь уже заведён", async () => {
    const { repo, service } = setup();
    await service.ensureTelegramUser(user);
    await service.saveTelegramProfile({ ...user, username: "alice_new" });
    await service.saveTelegramProfile(user);
    expect(repo.upsertTelegramProfile).toHaveBeenCalledTimes(3);
    expect(repo.upsertTelegramProfile).toHaveBeenNthCalledWith(2, { ...user, username: "alice_new" });
  });
});
