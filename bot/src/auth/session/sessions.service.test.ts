import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("../../db/index.js", () => ({ db: {}, schema: {} }));

const { SessionsService } = await import("./sessions.service.js");
const { hashSessionToken } = await import("./session-token.js");
const { SESSION_TTL_MS } = await import("./session.constants.js");
type Repo = ConstructorParameters<typeof SessionsService>[0];

const NOW = new Date("2026-10-11T12:00:00Z");
const HOUR = 60 * 60 * 1000;

function setup() {
  const repo = {
    insert: vi.fn().mockResolvedValue(undefined),
    findActive: vi.fn(),
    extend: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    deleteExpired: vi.fn().mockResolvedValue(0),
  };
  return { repo, service: new SessionsService(repo as unknown as Repo) };
}

describe("SessionsService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("create: в БД уходит хэш токена и срок 30 дней, наружу — сам токен", async () => {
    const { repo, service } = setup();
    const token = await service.create("u1", "UA");
    expect(repo.insert).toHaveBeenCalledWith("u1", hashSessionToken(token), new Date(NOW.getTime() + SESSION_TTL_MS), "UA");
    expect(token).not.toBe(hashSessionToken(token));
  });

  it("resolve: нет сессии (или просрочена) — null", async () => {
    const { repo, service } = setup();
    repo.findActive.mockResolvedValue(undefined);
    await expect(service.resolve("t")).resolves.toBeNull();
  });

  it("resolve: недавно использованная — без продления", async () => {
    const { repo, service } = setup();
    repo.findActive.mockResolvedValue({ userId: "u1", lastUsedAt: new Date(NOW.getTime() - 10 * 60 * 1000) });
    await expect(service.resolve("t")).resolves.toEqual({ userId: "u1", extended: false });
    expect(repo.extend).not.toHaveBeenCalled();
  });

  it("resolve: больше часа без продления — срок сдвигается на 30 дней от сейчас", async () => {
    const { repo, service } = setup();
    repo.findActive.mockResolvedValue({ userId: "u1", lastUsedAt: new Date(NOW.getTime() - 2 * HOUR) });
    await expect(service.resolve("t")).resolves.toEqual({ userId: "u1", extended: true });
    expect(repo.extend).toHaveBeenCalledWith(hashSessionToken("t"), new Date(NOW.getTime() + SESSION_TTL_MS));
  });

  it("revoke удаляет по хэшу", async () => {
    const { repo, service } = setup();
    await service.revoke("t");
    expect(repo.delete).toHaveBeenCalledWith(hashSessionToken("t"));
  });
});
