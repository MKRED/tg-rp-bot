import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("../db/index.js", () => ({ db: {}, schema: {} }));
const capture = {
  cacheDebugSettings: vi.fn(),
  clearDebugRecords: vi.fn(),
  getDebugRecords: vi.fn().mockReturnValue([{ id: 1 }]),
  primeDebugSettings: vi.fn(),
};
vi.mock("../llm/debugCapture.js", () => capture);

const { DebugService } = await import("./debug.service.js");
const logger = (await import("../logger.js")).default;
type Repo = ConstructorParameters<typeof DebugService>[0];

const SETTINGS = { enabled: true, maxRequests: 30, headMessages: 3, tailMessages: 5 };
function setup() {
  const repo = {
    getSettings: vi.fn().mockResolvedValue(SETTINGS),
    upsertSettings: vi.fn().mockResolvedValue({ ...SETTINGS, enabled: false }),
    listAllSettings: vi.fn().mockResolvedValue([{ userId: 7, ...SETTINGS }]),
  };
  return { service: new DebugService(repo as unknown as Repo), repo };
}

describe("DebugService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("view: настройки из БД кладутся в кэш перехвата, записи — только этого пользователя", async () => {
    const { service } = setup();
    await expect(service.view(1)).resolves.toEqual({ settings: SETTINGS, records: [{ id: 1 }] });
    expect(capture.cacheDebugSettings).toHaveBeenCalledWith(1, SETTINGS);
    expect(capture.getDebugRecords).toHaveBeenCalledWith(1);
  });

  it("updateSettings: итог из репозитория уходит и в кэш, и в ответ", async () => {
    const { service, repo } = setup();
    const saved = await service.updateSettings(1, { enabled: false });
    expect(repo.upsertSettings).toHaveBeenCalledWith(1, { enabled: false });
    expect(capture.cacheDebugSettings).toHaveBeenCalledWith(1, saved);
    expect(saved.enabled).toBe(false);
  });

  it("clearRecords чистит только записи пользователя", () => {
    setup().service.clearRecords(1);
    expect(capture.clearDebugRecords).toHaveBeenCalledWith(1);
  });

  it("прайм кэша на старте; сбой БД — warn, без падения", async () => {
    const { service, repo } = setup();
    service.onApplicationBootstrap();
    await vi.waitFor(() => expect(capture.primeDebugSettings).toHaveBeenCalledWith([{ userId: 7, ...SETTINGS }]));

    repo.listAllSettings.mockRejectedValueOnce(new Error("db down"));
    service.onApplicationBootstrap();
    await vi.waitFor(() => expect(logger.warn).toHaveBeenCalled());
  });
});
