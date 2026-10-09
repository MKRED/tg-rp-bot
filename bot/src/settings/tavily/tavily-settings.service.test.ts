import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("../../db/index.js", () => ({ db: {}, schema: {} }));
const getTavilyUsage = vi.fn();
vi.mock("../../tavily/tavilyUsage.js", () => ({ getTavilyUsage }));

const { TavilySettingsService } = await import("./tavily-settings.service.js");
const { TavilyHttpError } = await import("../../tavily/errors.js");
type Repo = ConstructorParameters<typeof TavilySettingsService>[0];

function setup(savedKey: string | null = "tvly-saved") {
  const repo = {
    getStatus: vi.fn(),
    getDecryptedKey: vi.fn().mockResolvedValue(savedKey),
    upsert: vi.fn().mockResolvedValue({ hasKey: true, last4: "1234", maxSearchRounds: 4 }),
  };
  return { service: new TavilySettingsService(repo as unknown as Repo), repo };
}

describe("TavilySettingsService.verify", () => {
  beforeEach(() => vi.clearAllMocks());

  it("введённый ключ — квота в ответе; пустой — реверификация сохранённого", async () => {
    const usage = { plan: "free", planUsage: 3, planLimit: 1000 };
    getTavilyUsage.mockResolvedValue(usage);
    const { service, repo } = setup();
    await expect(service.verify(1, "tvly-typed")).resolves.toEqual({ ok: true, usage });
    expect(repo.getDecryptedKey).not.toHaveBeenCalled();
    await service.verify(1, "");
    expect(getTavilyUsage).toHaveBeenLastCalledWith("tvly-saved");
  });

  it("нет ключа — ok:false no_key без вызова Tavily", async () => {
    await expect(setup(null).service.verify(1, "")).resolves.toEqual({ ok: false, error: "no_key" });
    expect(getTavilyUsage).not.toHaveBeenCalled();
  });

  it("401 от Tavily — ok:false invalid_key; прочие ошибки пробрасываются", async () => {
    const { service } = setup();
    getTavilyUsage.mockRejectedValueOnce(new TavilyHttpError(401, "unauthorized"));
    await expect(service.verify(1, "")).resolves.toEqual({ ok: false, error: "invalid_key" });
    getTavilyUsage.mockRejectedValueOnce(new TavilyHttpError(500, "down"));
    await expect(service.verify(1, "")).rejects.toBeInstanceOf(TavilyHttpError);
  });
});

describe("TavilySettingsService.update", () => {
  beforeEach(() => vi.clearAllMocks());

  it("лимит раундов и удаление ключа сохраняются как есть (кламп — в репозитории)", async () => {
    const { service, repo } = setup();
    await service.update(1, { maxSearchRounds: 99, apiKey: null });
    expect(repo.upsert).toHaveBeenCalledWith(1, { maxSearchRounds: 99, apiKey: null });
  });

  it("ключ плохого формата — 400 invalid_key_format, без записи", () => {
    const { service, repo } = setup();
    expect(() => service.update(1, { apiKey: "" })).toThrow(BadRequestException);
    expect(repo.upsert).not.toHaveBeenCalled();
  });
});
