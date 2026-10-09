import { describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("../../db/index.js", () => ({ db: {}, schema: {} }));

const { StorySettingsService } = await import("./story-settings.service.js");
type A = ConstructorParameters<typeof StorySettingsService>;

const CURRENT = { translateEnabled: false, compactFloorTokens: 0 };

function setup(presetId: number | null = 3) {
  const settings = { get: vi.fn().mockResolvedValue(CURRENT), upsert: vi.fn(async (_id: number, patch: object) => ({ ...CURRENT, ...patch })) };
  const access = { requireRow: vi.fn().mockResolvedValue({ id: 5, presetId }) };
  const presets = { findOne: vi.fn().mockResolvedValue({ contextUnlimited: false, contextSize: 16000 }) };
  const service = new StorySettingsService(settings as unknown as A[0], access as unknown as A[1], presets as unknown as A[2]);
  return { service, settings, presets };
}

describe("StorySettingsService.update", () => {
  it("пустой патч (все поля невалидны) — текущие настройки без записи", async () => {
    const { service, settings } = setup();
    expect(await service.update(1, 5, { translateEnabled: undefined })).toEqual(CURRENT);
    expect(settings.upsert).not.toHaveBeenCalled();
  });

  it("пол сжатия клампится по окну контекста пресета истории", async () => {
    const { service, settings, presets } = setup();
    await service.update(1, 5, { compactFloorTokens: 99999 });
    expect(presets.findOne).toHaveBeenCalledWith(1, 3);
    expect(settings.upsert).toHaveBeenCalledWith(5, { compactFloorTokens: 14400 });
  });

  it("без пресета — пол сохраняется сырым (≥ 0), пресет не читаем", async () => {
    const { service, settings, presets } = setup(null);
    await service.update(1, 5, { compactFloorTokens: -10 });
    expect(presets.findOne).not.toHaveBeenCalled();
    expect(settings.upsert).toHaveBeenCalledWith(5, { compactFloorTokens: 0 });
  });

  it("без пола — пресет не нужен", async () => {
    const { service, presets, settings } = setup();
    await service.update(1, 5, { editEnabled: true });
    expect(presets.findOne).not.toHaveBeenCalled();
    expect(settings.upsert).toHaveBeenCalledWith(5, { editEnabled: true });
  });
});
