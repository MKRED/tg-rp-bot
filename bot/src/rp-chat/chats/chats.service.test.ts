import { HttpException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("../../db/index.js", () => ({ db: {}, schema: {} }));

const { ChatsService } = await import("./chats.service.js");
type Args = ConstructorParameters<typeof ChatsService>;

const INPUT = { characterId: 1, personaId: 2, templateId: 3, presetId: 4, firstMessageIndex: 0 };

function setup() {
  const chats = {
    list: vi.fn(),
    findDetail: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue({ id: 77 }),
    rename: vi.fn().mockResolvedValue({ title: "T" }),
    remove: vi.fn().mockResolvedValue(true),
    tree: vi.fn().mockResolvedValue([]),
  };
  const access = { requireRow: vi.fn().mockResolvedValue({ id: 5, activeMessageId: null }) };
  const characters = { findOne: vi.fn().mockResolvedValue({ firstMessages: ["Привет", "Здравствуй"] }) };
  const personas = { findOne: vi.fn().mockResolvedValue({}) };
  const templates = { findOne: vi.fn().mockResolvedValue({}) };
  const presets = { findOne: vi.fn().mockResolvedValue({}) };
  const service = new ChatsService(
    chats as unknown as Args[0],
    access as unknown as Args[1],
    characters as unknown as Args[2],
    personas as unknown as Args[3],
    templates as unknown as Args[4],
    presets as unknown as Args[5],
  );
  return { service, chats, access, characters, personas, templates, presets };
}

async function httpError(promise: Promise<unknown>) {
  const err = await promise.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(HttpException);
  return { status: (err as HttpException).getStatus(), message: (err as HttpException).message };
}

describe("ChatsService.create", () => {
  it("выбранное приветствие уходит стартовым сообщением; вне диапазона — чат без него", async () => {
    const { service, chats } = setup();
    await service.create(9, { ...INPUT, firstMessageIndex: 1 });
    expect(chats.create).toHaveBeenLastCalledWith(9, { characterId: 1, personaId: 2, templateId: 3, presetId: 4 }, "Здравствуй");
    for (const idx of [5, -1, 0.5]) {
      await service.create(9, { ...INPUT, firstMessageIndex: idx });
      expect(chats.create.mock.lastCall?.[2]).toBeNull();
    }
  });

  it("чужие сущности — 404 по порядку проверки, чат не создаётся", async () => {
    const cases = [
      ["characters", "Character not found"],
      ["personas", "Persona not found"],
      ["templates", "Template not found"],
      ["presets", "Preset not found"],
    ] as const;
    for (const [repo, message] of cases) {
      const ctx = setup();
      ctx[repo].findOne.mockResolvedValue(undefined);
      expect(await httpError(ctx.service.create(9, INPUT))).toEqual({ status: 404, message });
      expect(ctx.chats.create).not.toHaveBeenCalled();
    }
  });
});

describe("ChatsService — 404 Chat not found", () => {
  it("get / rename / remove чужого или несуществующего чата", async () => {
    const { service, chats } = setup();
    expect(await httpError(service.get(9, 5))).toEqual({ status: 404, message: "Chat not found" });
    chats.rename.mockResolvedValueOnce(undefined);
    expect((await httpError(service.rename(9, 5, "x"))).message).toBe("Chat not found");
    chats.remove.mockResolvedValueOnce(false);
    expect((await httpError(service.remove(9, 5))).message).toBe("Chat not found");
  });

  it("rename отдаёт применённое название (null — очищено)", async () => {
    const { service, chats } = setup();
    chats.rename.mockResolvedValueOnce({ title: null });
    await expect(service.rename(9, 5, "  ")).resolves.toBeNull();
  });
});
