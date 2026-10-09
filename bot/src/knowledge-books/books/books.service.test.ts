import { HttpException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("../../db/index.js", () => ({ db: {}, schema: {} }));

const { BooksService } = await import("./books.service.js");
type Repo = ConstructorParameters<typeof BooksService>[0];

const BOOK = { id: 5, name: "Мир", description: null };
function setup() {
  const repo = {
    list: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(BOOK),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue(BOOK),
    update: vi.fn().mockResolvedValue(BOOK),
    remove: vi.fn().mockResolvedValue(true),
  };
  return { service: new BooksService(repo as unknown as Repo), repo };
}

async function httpError(promise: Promise<unknown>) {
  const err = await promise.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(HttpException);
  return { status: (err as HttpException).getStatus(), message: (err as HttpException).message };
}

describe("BooksService", () => {
  it("create: до лимита — создаёт; на лимите — 400 без записи", async () => {
    const { service, repo } = setup();
    await expect(service.create(1, { name: "Мир", description: null })).resolves.toBe(BOOK);
    repo.count.mockResolvedValueOnce(50);
    expect(await httpError(service.create(1, { name: "Ещё", description: null }))).toEqual({
      status: 400,
      message: "Book limit reached (max 50)",
    });
    expect(repo.create).toHaveBeenCalledTimes(1);
  });

  it("get/update чужой или несуществующей книги — 404", async () => {
    const { service, repo } = setup();
    repo.findOne.mockResolvedValueOnce(undefined);
    expect((await httpError(service.get(1, 5))).status).toBe(404);
    repo.update.mockResolvedValueOnce(undefined);
    expect((await httpError(service.update(1, 5, { name: "x", description: null }))).status).toBe(404);
  });

  it("remove: книга занята историей (FK 23503) — 409 in_use; не найдена — 404", async () => {
    const { service, repo } = setup();
    repo.remove.mockRejectedValueOnce(Object.assign(new Error("fk"), { cause: { code: "23503" } }));
    expect(await httpError(service.remove(1, 5))).toEqual({ status: 409, message: "in_use" });
    repo.remove.mockResolvedValueOnce(false);
    expect((await httpError(service.remove(1, 5))).status).toBe(404);
  });

  it("remove: прочая ошибка БД пробрасывается как есть (её логирует ApiExceptionFilter)", async () => {
    const { service, repo } = setup();
    repo.remove.mockRejectedValueOnce(new Error("db down"));
    await expect(service.remove(1, 5)).rejects.toThrow("db down");
  });
});
