import type { HttpException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

vi.mock("../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("../db/index.js", () => ({ db: {}, schema: {} }));

const { DEFAULT_NARRATOR_PROMPT_ORDER } = await import("../prompt/storyPromptBuilder/index.js");
const { StoryContextService } = await import("./story-context.service.js");
type A = ConstructorParameters<typeof StoryContextService>;

const ROW = { id: 5, activeMessageId: 9, bookId: 1, templateId: 2, presetId: 3 };
const DETAIL = { id: 5, activeMessageId: 9, book: { id: 1 }, template: { id: 2 }, preset: { id: 3 }, messages: [] };
const compactOrder = (enabled: boolean) => DEFAULT_NARRATOR_PROMPT_ORDER.map((i) => (i.id === "compact" ? { ...i, enabled } : i));

function setup() {
  const stories = { findRow: vi.fn().mockResolvedValue(ROW), findDetail: vi.fn().mockResolvedValue(DETAIL) };
  const messages = { findOne: vi.fn() };
  const settings = { get: vi.fn().mockResolvedValue({ compactEnabled: true }) };
  const compactions = { list: vi.fn().mockResolvedValue([{ id: 1 }]) };
  const templates = { findOne: vi.fn().mockResolvedValue({ promptOrder: compactOrder(true) }) };
  const presets = { findOne: vi.fn().mockResolvedValue({ id: 3 }) };
  const entries = { findActive: vi.fn().mockResolvedValue([]) };
  const service = new StoryContextService(
    stories as unknown as A[0],
    messages as unknown as A[1],
    settings as unknown as A[2],
    compactions as unknown as A[3],
    templates as unknown as A[4],
    presets as unknown as A[5],
    entries as unknown as A[6],
  );
  return { service, stories, messages, settings, compactions, templates };
}

const message = async (p: Promise<unknown>) => ((await p.catch((e: unknown) => e)) as HttpException).message;

describe("StoryContextService", () => {
  it("чужая история — 404 Story not found, сообщение не читаем", async () => {
    const { service, stories, messages } = setup();
    stories.findRow.mockResolvedValueOnce(undefined);
    expect(await message(service.requireMessage(1, 5, 9))).toBe("Story not found");
    expect(messages.findOne).not.toHaveBeenCalled();
  });

  it("сообщения нет в этой истории — 404 Message not found; ищем в пределах истории", async () => {
    const { service, messages } = setup();
    messages.findOne.mockResolvedValueOnce(undefined);
    expect(await message(service.requireMessage(1, 5, 9))).toBe("Message not found");
    expect(messages.findOne).toHaveBeenCalledWith(1, 5, 9);
  });

  it("контекст: пересказы читаются, когда сжатие включено и в шаблоне, и в настройках", async () => {
    const { service, compactions } = setup();
    expect((await service.requireContext(1, 5)).compactions).toEqual([{ id: 1 }]);
    expect(compactions.list).toHaveBeenCalledWith(1, 5);
  });

  it.each([
    { name: "выключено в настройках", settings: { compactEnabled: false }, order: compactOrder(true) },
    { name: "компонент выключен в шаблоне", settings: { compactEnabled: true }, order: compactOrder(false) },
  ])("контекст: $name — пересказы не читаем", async ({ settings, order }) => {
    const s = setup();
    s.settings.get.mockResolvedValueOnce(settings);
    s.templates.findOne.mockResolvedValueOnce({ promptOrder: order });
    expect((await s.service.requireContext(1, 5)).compactions).toEqual([]);
    expect(s.compactions.list).not.toHaveBeenCalled();
  });

  it("контекст: шаблон удалён — null, генерация не падает", async () => {
    const { service, templates } = setup();
    templates.findOne.mockResolvedValueOnce(undefined);
    expect((await service.requireContext(1, 5)).template).toBeNull();
  });
});
