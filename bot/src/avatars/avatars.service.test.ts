import { HttpException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

vi.mock("../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("../db/index.js", () => ({ db: {}, schema: {} }));

const { AvatarsService } = await import("./avatars.service.js");
type Repo = ConstructorParameters<typeof AvatarsService>[0];

function setup() {
  const repo = { findBatch: vi.fn().mockResolvedValue([{ type: "character", id: 1, dataUrl: "data:x" }]) };
  return { service: new AvatarsService(repo as unknown as Repo), repo };
}
const refs = (n: number) => Array.from({ length: n }, (_, i) => ({ type: "character" as const, id: i }));

describe("AvatarsService", () => {
  it("пустой батч — пустой ответ без запроса в БД", async () => {
    const { service, repo } = setup();
    await expect(service.resolveBatch(1, [])).resolves.toEqual([]);
    expect(repo.findBatch).not.toHaveBeenCalled();
  });

  it("до лимита включительно — запрос к репозиторию с владельцем", async () => {
    const { service, repo } = setup();
    await expect(service.resolveBatch(7, refs(60))).resolves.toHaveLength(1);
    expect(repo.findBatch).toHaveBeenCalledWith(7, refs(60));
  });

  it("больше 60 — 400 Too many refs", async () => {
    const { service, repo } = setup();
    const err = await service.resolveBatch(1, refs(61)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(400);
    expect((err as HttpException).message).toBe("Too many refs (max 60)");
    expect(repo.findBatch).not.toHaveBeenCalled();
  });
});
