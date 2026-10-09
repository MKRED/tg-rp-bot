import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("../../db/index.js", () => ({ db: {}, schema: {} }));
const listDeepSeekModels = vi.fn();
vi.mock("../../llm/deepseekModels.js", () => ({ listDeepSeekModels }));
const getDeepSeekBalance = vi.fn();
vi.mock("../../llm/deepseekBalance.js", () => ({ getDeepSeekBalance }));

const { LlmSettingsService } = await import("./llm-settings.service.js");
const { LlmHttpError } = await import("../../llm/errors.js");
type Repo = ConstructorParameters<typeof LlmSettingsService>[0];

const SAVED = { apiKey: "sk-saved", model: null };
function setup(creds: { apiKey: string; model: string | null } | null = SAVED) {
  const repo = {
    getStatus: vi.fn(),
    getDecryptedCredentials: vi.fn().mockResolvedValue(creds),
    upsert: vi.fn().mockResolvedValue({ hasKey: true, last4: "1234", model: null }),
  };
  return { service: new LlmSettingsService(repo as unknown as Repo), repo };
}

/** Ошибка BadRequestException → тело ответа, как его отдал бы ApiExceptionFilter (до склейки). */
async function badRequest(promise: Promise<unknown>) {
  const err = await promise.then(() => undefined, (e: unknown) => e);
  expect(err).toBeInstanceOf(BadRequestException);
  return (err as BadRequestException).getResponse();
}

describe("LlmSettingsService.verify", () => {
  beforeEach(() => vi.clearAllMocks());

  it("введённый ключ проверяется сам, сохранённый не читается", async () => {
    listDeepSeekModels.mockResolvedValue(["m1", "m2"]);
    const { service, repo } = setup();
    await expect(service.verify(1, "sk-typed")).resolves.toEqual({ ok: true, models: ["m1", "m2"] });
    expect(listDeepSeekModels).toHaveBeenCalledWith("sk-typed");
    expect(repo.getDecryptedCredentials).not.toHaveBeenCalled();
  });

  it("без введённого — реверификация сохранённого", async () => {
    listDeepSeekModels.mockResolvedValue([]);
    const { service } = setup();
    await service.verify(1, "");
    expect(listDeepSeekModels).toHaveBeenCalledWith("sk-saved");
  });

  it("ни введённого, ни сохранённого — ok:false no_key без вызова DeepSeek", async () => {
    const { service } = setup(null);
    await expect(service.verify(1, "")).resolves.toEqual({ ok: false, error: "no_key" });
    expect(listDeepSeekModels).not.toHaveBeenCalled();
  });

  it("401 от DeepSeek — ok:false invalid_key; прочие ошибки пробрасываются", async () => {
    const { service } = setup();
    listDeepSeekModels.mockRejectedValueOnce(new LlmHttpError("deepseek", 401, "unauthorized"));
    await expect(service.verify(1, "sk-x")).resolves.toEqual({ ok: false, error: "invalid_key" });
    listDeepSeekModels.mockRejectedValueOnce(new LlmHttpError("deepseek", 503, "down"));
    await expect(service.verify(1, "sk-x")).rejects.toBeInstanceOf(LlmHttpError);
  });
});

describe("LlmSettingsService.balance", () => {
  beforeEach(() => vi.clearAllMocks());

  it("баланс сохранённого ключа", async () => {
    const balance = { isAvailable: true, balanceInfos: [] };
    getDeepSeekBalance.mockResolvedValue(balance);
    const { service } = setup();
    await expect(service.balance(1)).resolves.toBe(balance);
    expect(getDeepSeekBalance).toHaveBeenCalledWith("sk-saved");
  });

  it("нет ключа — 400 no_key; 401 — 400 invalid_key", async () => {
    expect(await badRequest(setup(null).service.balance(1))).toMatchObject({ message: "no_key" });
    getDeepSeekBalance.mockRejectedValueOnce(new LlmHttpError("deepseek", 401, "unauthorized"));
    expect(await badRequest(setup().service.balance(1))).toMatchObject({ message: "invalid_key" });
  });
});

describe("LlmSettingsService.update", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([{ model: "m" }, { apiKey: null }, { apiKey: "sk-new", model: "m" }])("патч %j сохраняется как есть", async (patch) => {
    const { service, repo } = setup();
    await service.update(1, patch);
    expect(repo.upsert).toHaveBeenCalledWith(1, patch);
  });

  it("ключ плохого формата — 400 invalid_key_format, без записи", async () => {
    const { service, repo } = setup();
    const body = await badRequest(Promise.resolve().then(() => service.update(1, { apiKey: "sk bad" })));
    expect(body).toMatchObject({ error: "invalid_key_format" });
    expect(repo.upsert).not.toHaveBeenCalled();
  });
});
