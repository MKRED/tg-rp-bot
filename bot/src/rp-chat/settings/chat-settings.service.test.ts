import { describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("../../db/index.js", () => ({ db: {}, schema: {} }));

const { ChatSettingsService } = await import("./chat-settings.service.js");

const asArg = <T>(v: unknown) => v as T;
const ROW = { id: 5, activeMessageId: 12, templateId: 3, presetId: 4 };

describe("ChatSettingsService.update", () => {
  function setup() {
    const settings = { get: vi.fn().mockResolvedValue({ translateEnabled: false }), upsert: vi.fn().mockResolvedValue({}) };
    const access = { requireRow: vi.fn().mockResolvedValue(ROW) };
    type A = ConstructorParameters<typeof ChatSettingsService>;
    return { service: new ChatSettingsService(asArg<A[0]>(settings), asArg<A[1]>(access)), settings };
  }

  it("пишет только определённые поля; пустой патч — без записи, текущие настройки", async () => {
    const { service, settings } = setup();
    await service.update(1, 5, { translateEnabled: true, translateScope: undefined });
    expect(settings.upsert).toHaveBeenCalledWith(5, { translateEnabled: true });
    settings.upsert.mockClear();
    await expect(service.update(1, 5, { translateScope: undefined })).resolves.toEqual({ translateEnabled: false });
    expect(settings.upsert).not.toHaveBeenCalled();
  });
});
