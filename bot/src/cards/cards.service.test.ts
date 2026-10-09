import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { MAX_CARDS_PER_USER } from "@tg-rp-bot/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
// Репозитории подменяются целиком; модуль БД (и config.ts с обязательным .env) не грузим.
vi.mock("../db/index.js", () => ({ db: {}, schema: {} }));

const { CardsService } = await import("./cards.service.js");
const { tryLockCard, unlockCard } = await import("./card-lock.js");
type Repo = ConstructorParameters<typeof CardsService>[0];
type Presets = ConstructorParameters<typeof CardsService>[1];

const input = {
  name: "A",
  systemPrompt: "",
  prompt: "",
  categories: [],
  presetId: null,
  useWebSearch: false,
  useAskUser: false,
};

function makeService(
  repo: Partial<Record<keyof Repo, unknown>>,
  presetFound: boolean | undefined = undefined,
) {
  const presets = { findOne: vi.fn().mockResolvedValue(presetFound ? { id: 3 } : undefined) };
  return { service: new CardsService(repo as Repo, presets as unknown as Presets), presets };
}

describe("CardsService", () => {
  afterEach(() => unlockCard(5));

  it("list — updatedAt сериализуется в ISO-строку", async () => {
    const updatedAt = new Date("2026-10-09T10:00:00.000Z");
    const { service } = makeService({ list: vi.fn().mockResolvedValue([{ id: 1, name: "A", updatedAt }]) });
    await expect(service.list(1)).resolves.toEqual([{ id: 1, name: "A", updatedAt: "2026-10-09T10:00:00.000Z" }]);
  });

  it("create — отказ при достижении лимита, без записи", async () => {
    const create = vi.fn();
    const { service } = makeService({ count: vi.fn().mockResolvedValue(MAX_CARDS_PER_USER), create });
    await expect(service.create(1, input)).rejects.toThrow(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it("create без пресета — пишет, пресет не ищется", async () => {
    const create = vi.fn().mockResolvedValue({ id: 7 });
    const { service, presets } = makeService({ count: vi.fn().mockResolvedValue(0), create });
    await expect(service.create(1, input)).resolves.toEqual({ id: 7 });
    expect(create).toHaveBeenCalledWith(1, input);
    expect(presets.findOne).not.toHaveBeenCalled();
  });

  it("create с чужим/несуществующим пресетом — 404 раньше проверки лимита", async () => {
    const count = vi.fn();
    const { service, presets } = makeService({ count }, false);
    await expect(service.create(1, { ...input, presetId: 3 })).rejects.toThrow("Preset not found");
    expect(presets.findOne).toHaveBeenCalledWith(1, 3);
    expect(count).not.toHaveBeenCalled();
  });

  it("create со своим пресетом — пишет", async () => {
    const create = vi.fn().mockResolvedValue({ id: 7 });
    const { service } = makeService({ count: vi.fn().mockResolvedValue(0), create }, true);
    await expect(service.create(1, { ...input, presetId: 3 })).resolves.toEqual({ id: 7 });
  });

  it("get/update — undefined от репозитория превращается в 404", async () => {
    const { service } = makeService({
      findOne: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
    });
    await expect(service.get(1, 5)).rejects.toThrow(NotFoundException);
    await expect(service.update(1, 5, input)).rejects.toThrow(NotFoundException);
  });

  it("update — карточка занята генерацией: 409 busy, без записи, чужой лок не снимается", async () => {
    const update = vi.fn();
    const { service } = makeService({ update });
    expect(tryLockCard(5)).toBe(true);
    await expect(service.update(1, 5, input)).rejects.toThrow(ConflictException);
    expect(update).not.toHaveBeenCalled();
    expect(tryLockCard(5)).toBe(false);
  });

  it("update — лок снимается и после успеха, и после ошибки", async () => {
    const { service } = makeService({
      update: vi.fn().mockResolvedValueOnce({ id: 5 }).mockRejectedValueOnce(new Error("db")),
    });
    await expect(service.update(1, 5, input)).resolves.toEqual({ id: 5 });
    await expect(service.update(1, 5, input)).rejects.toThrow("db");
    expect(tryLockCard(5)).toBe(true);
  });

  it("update с чужим пресетом — 404 до лока и записи", async () => {
    const update = vi.fn();
    const { service } = makeService({ update }, false);
    await expect(service.update(1, 5, { ...input, presetId: 3 })).rejects.toThrow("Preset not found");
    expect(update).not.toHaveBeenCalled();
    expect(tryLockCard(5)).toBe(true);
  });

  it("remove — не удалено → 404", async () => {
    const { service } = makeService({ delete: vi.fn().mockResolvedValue(false) });
    await expect(service.remove(1, 5)).rejects.toThrow(NotFoundException);
  });
});
