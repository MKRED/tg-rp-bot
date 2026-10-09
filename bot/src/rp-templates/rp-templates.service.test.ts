import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { MAX_RP_TEMPLATES_PER_USER } from "@tg-rp-bot/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
// Репозиторий подменяется целиком; модуль БД (и config.ts с обязательным .env) не грузим.
vi.mock("../db/index.js", () => ({ db: {}, schema: {} }));

const { RpTemplatesService } = await import("./rp-templates.service.js");
type Repo = ConstructorParameters<typeof RpTemplatesService>[0];

const ids = ["system", "characterDescription", "characterScenario", "userDescription", "auxiliary", "history", "postHistory"] as const;
const input = {
  name: "A",
  systemPrompt: "",
  auxiliarySystemPrompt: "",
  postHistoryInstruction: "",
  userPersonaPrompt: "",
  userPersonaStreaming: true,
  translationSystemPrompt: "",
  promptOrder: ids.map((id) => ({ id, enabled: true })),
};

function makeService(repo: Partial<Record<keyof Repo, unknown>>) {
  return new RpTemplatesService(repo as Repo);
}

describe("RpTemplatesService", () => {
  it("create — отказ при достижении лимита, без записи", async () => {
    const create = vi.fn();
    const service = makeService({ count: vi.fn().mockResolvedValue(MAX_RP_TEMPLATES_PER_USER), create });
    await expect(service.create(1, input)).rejects.toThrow(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it("create — ниже лимита пишет через репозиторий", async () => {
    const create = vi.fn().mockResolvedValue({ id: 7 });
    const service = makeService({ count: vi.fn().mockResolvedValue(0), create });
    await expect(service.create(1, input)).resolves.toEqual({ id: 7 });
    expect(create).toHaveBeenCalledWith(1, input);
  });

  it("list — без текстов промптов: updatedAt ISO-строкой, вес только включённых компонентов", async () => {
    const updatedAt = new Date("2026-01-02T03:04:05.000Z");
    const row = {
      id: 3,
      name: "T",
      updatedAt,
      systemPrompt: "один два три",
      auxiliarySystemPrompt: "четыре",
      postHistoryInstruction: "пять",
      promptOrder: ids.map((id) => ({ id, enabled: id === "system" })),
    };
    const service = makeService({ list: vi.fn().mockResolvedValue([row]) });
    const [item] = await service.list(1);
    expect(item).toStrictEqual({ id: 3, name: "T", updatedAt: updatedAt.toISOString(), templateTokens: item!.templateTokens });
    // выключенные auxiliary/postHistory в вес не входят
    const onlySystem = await makeService({
      list: vi.fn().mockResolvedValue([{ ...row, auxiliarySystemPrompt: "", postHistoryInstruction: "" }]),
    }).list(1);
    expect(item!.templateTokens).toBeGreaterThan(0);
    expect(onlySystem[0]!.templateTokens).toBe(item!.templateTokens);
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
