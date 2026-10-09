import { HttpException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

vi.mock("../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("../db/index.js", () => ({ db: {}, schema: {} }));

const { ChatContextService } = await import("./chat-context.service.js");

async function httpError(promise: Promise<unknown>) {
  const err = await promise.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(HttpException);
  return { status: (err as HttpException).getStatus(), message: (err as HttpException).message };
}

const asArg = <T>(v: unknown) => v as T;
const ROW = { id: 5, activeMessageId: 12, templateId: 3, presetId: 4 };

describe("ChatContextService", () => {
  function setup() {
    const chats = {
      findRow: vi.fn().mockResolvedValue(ROW),
      findDetail: vi.fn().mockResolvedValue({ character: { id: 1 }, persona: null, template: { id: 3 }, preset: null }),
    };
    const characters = { findOne: vi.fn().mockResolvedValue({ id: 1 }) };
    const personas = { findOne: vi.fn() };
    const templates = { findOne: vi.fn().mockResolvedValue({ id: 3 }) };
    const presets = { findOne: vi.fn() };
    type A = ConstructorParameters<typeof ChatContextService>;
    const service = new ChatContextService(
      asArg<A[0]>(chats),
      asArg<A[1]>(characters),
      asArg<A[2]>(personas),
      asArg<A[3]>(templates),
      asArg<A[4]>(presets),
    );
    return { service, chats, characters, personas };
  }

  it("нет чата или его персонажа — 404 Chat not found", async () => {
    const { service, chats, characters } = setup();
    chats.findRow.mockResolvedValueOnce(undefined);
    expect(await httpError(service.requireRow(1, 5))).toEqual({ status: 404, message: "Chat not found" });
    characters.findOne.mockResolvedValueOnce(undefined);
    expect(await httpError(service.requireContext(1, 5))).toEqual({ status: 404, message: "Chat not found" });
  });

  it("отсутствующие персона/пресет — null, без запроса к репозиторию", async () => {
    const { service, personas } = setup();
    const ctx = await service.requireContext(1, 5);
    expect(ctx).toMatchObject({ persona: null, template: { id: 3 }, preset: null });
    expect(personas.findOne).not.toHaveBeenCalled();
  });
});
