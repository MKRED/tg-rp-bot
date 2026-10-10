import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("../db/index.js", () => ({ db: {}, schema: {} }));

const { UserKeysService } = await import("./user-keys.service.js");
const { generateDataKey } = await import("../utils/crypto.js");
type Repo = ConstructorParameters<typeof UserKeysService>[0];

describe("UserKeysService.forUser", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = randomBytes(32).toString("hex");
  });
  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  it("разворачивает users.data_key и кэширует ключ на процесс", async () => {
    const { key, wrapped } = generateDataKey();
    const repo = { findWrappedKey: vi.fn().mockResolvedValue(wrapped) };
    const service = new UserKeysService(repo as unknown as Repo);

    expect((await service.forUser("u1")).equals(key)).toBe(true);
    expect((await service.forUser("u1")).equals(key)).toBe(true);
    expect(repo.findWrappedKey).toHaveBeenCalledTimes(1);
  });

  it("нет строки пользователя — ошибка, а не новый ключ", async () => {
    const repo = { findWrappedKey: vi.fn().mockResolvedValue(undefined) };
    const service = new UserKeysService(repo as unknown as Repo);
    await expect(service.forUser("missing")).rejects.toThrow("Нет ключа шифрования");
  });
});
