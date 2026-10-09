import { describe, expect, it, vi } from "vitest";

vi.mock("../../logger.js", () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock("../../db/index.js", () => ({ db: {}, schema: {} }));

const { DEFAULT_NARRATOR_PROMPT_ORDER } = await import("../../prompt/storyPromptBuilder/index.js");
const { StoryStatsService } = await import("./story-stats.service.js");
type A = ConstructorParameters<typeof StoryStatsService>;

const order = (compact: boolean) => DEFAULT_NARRATOR_PROMPT_ORDER.map((i) => (i.id === "compact" ? { ...i, enabled: compact } : i));
const template = (compact: boolean) => ({ systemPrompt: "Ты рассказчик.", promptOrder: order(compact), continueMarker: "", leadingUserMarker: "" });
const story = { id: 5, premise: "", activeMessageId: 1, messages: [{ id: 1, parentId: null, role: "assistant", kind: "beat", content: "Начало" }] };

function setup(over: { preset?: object | null; compact?: boolean }) {
  const ctx = { story, template: template(over.compact ?? true), preset: over.preset ?? null, settings: { compactEnabled: false }, compactions: [], entries: [] };
  const access = { requireContext: vi.fn().mockResolvedValue(ctx) };
  const stats = { tokenStats: vi.fn().mockResolvedValue({ tokensTotal: 10, tokensActiveBranch: 4 }) };
  return new StoryStatsService(access as unknown as A[0], stats as unknown as A[1]);
}

describe("StoryStatsService", () => {
  it("пресет с окном и компонент включён — сжатие доступно", async () => {
    const res = await setup({ preset: { contextUnlimited: false, contextSize: 16000 } }).get(1, 5);
    expect(res).toMatchObject({ tokensTotal: 10, tokensActiveBranch: 4, contextLimit: 16000, compactAvailable: true, compactReason: null, templateCompactEnabled: true });
    expect(res.tokensPrompt).toBeGreaterThan(0);
  });

  it("пресет подходит, компонент выключен — причина template_off", async () => {
    const res = await setup({ preset: { contextUnlimited: false, contextSize: 16000 }, compact: false }).get(1, 5);
    expect(res).toMatchObject({ compactAvailable: false, compactReason: "template_off", templateCompactEnabled: false });
  });

  it("безграничный контекст — лимита нет, причина unlimited (важнее шаблона)", async () => {
    const res = await setup({ preset: { contextUnlimited: true, contextSize: 16000 }, compact: false }).get(1, 5);
    expect(res).toMatchObject({ contextLimit: null, compactAvailable: false, compactReason: "unlimited" });
  });

  it("маленькое окно — too_small", async () => {
    const res = await setup({ preset: { contextUnlimited: false, contextSize: 2000 } }).get(1, 5);
    expect(res).toMatchObject({ contextLimit: 2000, compactReason: "too_small" });
  });
});
