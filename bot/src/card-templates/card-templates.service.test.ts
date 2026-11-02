import { BadRequestException, NotFoundException } from "@nestjs/common";
import { MAX_CARD_TEMPLATES_PER_USER } from "@tg-rp-bot/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
// Репозиторий подменяется целиком; модуль БД (и config.ts с обязательным .env) не грузим.
vi.mock("../db/index.js", () => ({ db: {}, schema: {} }));

const { CardTemplatesService } = await import("./card-templates.service.js");
type Repo = ConstructorParameters<typeof CardTemplatesService>[0];

const USER = "00000000-0000-0000-0000-000000000001";
const input = {
  name: "NPC",
  systemPrompt: "S",
  fields: [{ id: "base", title: "Base", description: "Name: ...", enabled: true }],
  useWebSearch: true,
  useAskUser: false,
  askUserFirst: false,
};
const createdAt = new Date("2026-01-02T03:04:05.000Z");
const updatedAt = new Date("2026-01-03T03:04:05.000Z");
const row = { id: 5, userId: USER, ...input, createdAt, updatedAt };

function makeService(repo: Partial<Record<keyof Repo, unknown>>) {
  return new CardTemplatesService(repo as Repo);
}

describe("CardTemplatesService", () => {
  it("create — отказ при достижении лимита, без записи", async () => {
    const create = vi.fn();
    const service = makeService({ count: vi.fn().mockResolvedValue(MAX_CARD_TEMPLATES_PER_USER), create });
    await expect(service.create(USER, input)).rejects.toThrow(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it("create — ниже лимита пишет и отдаёт контракт: ISO-даты, без userId", async () => {
    const create = vi.fn().mockResolvedValue(row);
    const service = makeService({ count: vi.fn().mockResolvedValue(0), create });
    await expect(service.create(USER, input)).resolves.toStrictEqual({
      id: 5,
      ...input,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
    expect(create).toHaveBeenCalledWith(USER, input);
  });

  it("list — шаблоны целиком в порядке репозитория", async () => {
    const service = makeService({ list: vi.fn().mockResolvedValue([row, { ...row, id: 6 }]) });
    const list = await service.list(USER);
    expect(list.map((t) => t.id)).toEqual([5, 6]);
    expect(list[0]!.fields).toEqual(input.fields);
  });

  it("get/update — чужой или несуществующий шаблон → 404", async () => {
    const service = makeService({ findOne: vi.fn().mockResolvedValue(undefined), update: vi.fn().mockResolvedValue(undefined) });
    await expect(service.get(USER, 1)).rejects.toThrow(NotFoundException);
    await expect(service.update(USER, 1, input)).rejects.toThrow(NotFoundException);
  });

  it("remove — 404, если строка не удалена", async () => {
    await expect(makeService({ delete: vi.fn().mockResolvedValue(false) }).remove(USER, 1)).rejects.toThrow(
      NotFoundException,
    );
    await expect(makeService({ delete: vi.fn().mockResolvedValue(true) }).remove(USER, 1)).resolves.toBeUndefined();
  });
});
