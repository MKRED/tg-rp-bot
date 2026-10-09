import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { MAX_PRESETS_PER_USER } from "@tg-rp-bot/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
// Репозиторий подменяется целиком; модуль БД (и config.ts с обязательным .env) не грузим.
vi.mock("../db/index.js", () => ({ db: {}, schema: {} }));

const { PresetsService } = await import("./presets.service.js");
type Repo = ConstructorParameters<typeof PresetsService>[0];

const input = {
  name: "A",
  contextUnlimited: false,
  contextSize: null,
  maxTokens: null,
  streaming: false,
  temperature: null,
  topP: null,
  topK: null,
  frequencyPenalty: null,
  presencePenalty: null,
  repetitionPenalty: null,
  minP: null,
  topA: null,
  requestReasoning: false,
  reasoningEffort: null,
};

function makeService(repo: Partial<Record<keyof Repo, unknown>>) {
  return new PresetsService(repo as Repo);
}

describe("PresetsService", () => {
  it("create — отказ при достижении лимита, без записи", async () => {
    const create = vi.fn();
    const service = makeService({ count: vi.fn().mockResolvedValue(MAX_PRESETS_PER_USER), create });
    await expect(service.create(1, input)).rejects.toThrow(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it("create — ниже лимита пишет через репозиторий", async () => {
    const create = vi.fn().mockResolvedValue({ id: 7 });
    const service = makeService({ count: vi.fn().mockResolvedValue(0), create });
    await expect(service.create(1, input)).resolves.toEqual({ id: 7 });
    expect(create).toHaveBeenCalledWith(1, input);
  });

  it("get/update — undefined от репозитория превращается в 404", async () => {
    const service = makeService({
      findOne: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
    });
    await expect(service.get(1, 2)).rejects.toThrow(NotFoundException);
    await expect(service.update(1, 2, input)).rejects.toThrow(NotFoundException);
  });

  it("remove — нарушение FK даёт 409 in_use", async () => {
    const fkError = Object.assign(new Error("fk"), { cause: { code: "23503" } });
    const service = makeService({ delete: vi.fn().mockRejectedValue(fkError) });
    await expect(service.remove(1, 2)).rejects.toThrow(ConflictException);
  });

  it("remove — прочие ошибки пробрасываются, отсутствие строки — 404", async () => {
    const boom = new Error("db down");
    await expect(makeService({ delete: vi.fn().mockRejectedValue(boom) }).remove(1, 2)).rejects.toBe(boom);
    await expect(makeService({ delete: vi.fn().mockResolvedValue(false) }).remove(1, 2)).rejects.toThrow(
      NotFoundException,
    );
  });
});
