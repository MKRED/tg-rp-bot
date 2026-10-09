import { HttpException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("../../db/index.js", () => ({ db: {}, schema: {} }));

const { EntriesService } = await import("./entries.service.js");
type Args = ConstructorParameters<typeof EntriesService>;

const INPUT = {
  name: "Запись",
  enabled: true,
  activation: "always_on" as const,
  characterId: null,
  personaId: null,
  alias: "",
  content: "Факт",
  keywords: [],
  keywordDepth: 10,
};

function setup() {
  const entries = {
    list: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue({ id: 42 }),
    update: vi.fn().mockResolvedValue(true),
    remove: vi.fn().mockResolvedValue(true),
    reorder: vi.fn().mockResolvedValue("ok"),
  };
  const characters = { findOne: vi.fn().mockResolvedValue({ prompt: "Рыцарь", scenario: "" }) };
  const personas = { findOne: vi.fn().mockResolvedValue({ prompt: "Путник" }) };
  const service = new EntriesService(
    entries as unknown as Args[0],
    characters as unknown as Args[1],
    personas as unknown as Args[2],
  );
  return { service, entries, characters, personas };
}

async function httpError(promise: Promise<unknown>) {
  const err = await promise.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(HttpException);
  return { status: (err as HttpException).getStatus(), message: (err as HttpException).message };
}

describe("EntriesService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("create: свободный текст — без проверки ссылок, id новой записи", async () => {
    const { service, characters, personas } = setup();
    await expect(service.create(1, 7, INPUT)).resolves.toEqual({ id: 42 });
    expect(characters.findOne).not.toHaveBeenCalled();
    expect(personas.findOne).not.toHaveBeenCalled();
  });

  it("чужой/несуществующий персонаж — 404 Character not found, запись не создаётся", async () => {
    const { service, characters, entries } = setup();
    characters.findOne.mockResolvedValue(undefined);
    expect(await httpError(service.create(1, 7, { ...INPUT, characterId: 3 }))).toEqual({
      status: 404,
      message: "Character not found",
    });
    expect(characters.findOne).toHaveBeenCalledWith(1, 3);
    expect(entries.create).not.toHaveBeenCalled();
  });

  it("персонаж с {{user}} без alias — 400 Alias required; с alias — проходит", async () => {
    const { service, characters } = setup();
    characters.findOne.mockResolvedValue({ prompt: "Друг {{user}}", scenario: "" });
    expect(await httpError(service.create(1, 7, { ...INPUT, characterId: 3 }))).toEqual({
      status: 400,
      message: "Alias required",
    });
    await expect(service.create(1, 7, { ...INPUT, characterId: 3, alias: "Странник" })).resolves.toEqual({ id: 42 });
  });

  it("персона: 404 Persona not found и {{char}} без alias — 400", async () => {
    const { service, personas } = setup();
    personas.findOne.mockResolvedValueOnce(undefined);
    expect((await httpError(service.update(1, 9, { ...INPUT, personaId: 4 }))).message).toBe("Persona not found");
    personas.findOne.mockResolvedValueOnce({ prompt: "Служу {{CHAR}}" });
    expect((await httpError(service.update(1, 9, { ...INPUT, personaId: 4 }))).message).toBe("Alias required");
  });

  it("лимит записей — 400 после проверки ссылки; книга не найдена — 404 Book not found", async () => {
    const { service, entries } = setup();
    entries.count.mockResolvedValueOnce(200);
    expect(await httpError(service.create(1, 7, INPUT))).toEqual({ status: 400, message: "Entry limit reached (max 200)" });
    entries.create.mockResolvedValueOnce(undefined);
    expect(await httpError(service.create(1, 7, INPUT))).toEqual({ status: 404, message: "Book not found" });
  });

  it("update/remove чужой или несуществующей записи — 404 Not found", async () => {
    const { service, entries } = setup();
    entries.update.mockResolvedValueOnce(false);
    expect((await httpError(service.update(1, 9, INPUT))).status).toBe(404);
    entries.remove.mockResolvedValueOnce(false);
    expect((await httpError(service.remove(1, 9))).message).toBe("Not found");
  });

  it("reorder: не перестановка — 400 Invalid order", async () => {
    const { service, entries } = setup();
    await expect(service.reorder(1, 7, [2, 1])).resolves.toBeUndefined();
    entries.reorder.mockResolvedValueOnce("invalid");
    expect(await httpError(service.reorder(1, 7, [2]))).toEqual({ status: 400, message: "Invalid order" });
  });
});
