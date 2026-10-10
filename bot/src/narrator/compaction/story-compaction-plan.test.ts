import type { StoryDetail, StoryMessage, StorySettings } from "@tg-rp-bot/shared";
import { describe, expect, it } from "vitest";
import type { GenerationPreset, NarratorTemplate } from "../../db/schema.js";
import { DEFAULT_COMPACTION_PROMPT, DEFAULT_NARRATOR_PROMPT_ORDER } from "../../prompt/storyPromptBuilder/index.js";
import { buildStoryCompletion, type StoryContext } from "../generation/story-completion.js";
import {
  compactBlockReason,
  compactionPrompt,
  compactionRequest,
  needsAutoCompaction,
  planStoryCompaction,
  promptTokens,
} from "./story-compaction-plan.js";

const msg = (id: number, role: "user" | "assistant", kind: StoryMessage["kind"], content: string): StoryMessage => ({
  id,
  parentId: id === 1 ? null : id - 1,
  role,
  kind,
  content,
  translations: null,
  createdAt: "",
  siblingIndex: 0,
  siblingCount: 1,
  siblings: [id],
});

const LONG = "слово ".repeat(2000);
// Открытие + 3 пары «ход → бит», последний — живой ход.
const path = [
  msg(1, "assistant", "beat", LONG),
  msg(2, "user", "directive", "дальше"),
  msg(3, "assistant", "beat", LONG),
  msg(4, "user", "continue", "[Дальше]"),
  msg(5, "assistant", "beat", LONG),
  msg(6, "user", "directive", "финал"),
];

const template = { systemPrompt: "Ты рассказчик.", promptOrder: DEFAULT_NARRATOR_PROMPT_ORDER, continueMarker: "", leadingUserMarker: "", compactionPrompt: "" } as unknown as NarratorTemplate;
const ctx = (over: { settings?: Partial<StorySettings>; preset?: Partial<GenerationPreset> | null; activeMessageId?: number | null } = {}): StoryContext => ({
  story: { id: 7, premise: "", activeMessageId: over.activeMessageId === undefined ? 6 : over.activeMessageId, messages: path } as unknown as StoryDetail,
  template,
  preset: over.preset === null ? null : ({ contextUnlimited: false, contextSize: 4000, maxTokens: 200, ...over.preset } as GenerationPreset),
  settings: { compactEnabled: true, compactAutoEnabled: true, compactFloorTokens: 1000, compactWords: 150, ...over.settings } as StorySettings,
  compactions: [],
  entries: [],
});
const untrimmed = (c: StoryContext) => buildStoryCompletion(c, { trim: false }).msgs;

describe("compactBlockReason", () => {
  it.each([
    { name: "всё включено", c: ctx(), on: true, out: null },
    { name: "без пресета", c: ctx({ preset: null }), on: true, out: "unavailable" },
    { name: "окно меньше 4000", c: ctx({ preset: { contextSize: 3000 } }), on: true, out: "unavailable" },
    { name: "компонент выключен", c: ctx(), on: false, out: "gate_off" },
    { name: "сжатие выключено в настройках", c: ctx({ settings: { compactEnabled: false } }), on: true, out: "gate_off" },
    { name: "нет курсора", c: ctx({ activeMessageId: null }), on: true, out: "no_active" },
  ])("$name → $out", ({ c, on, out }) => {
    expect(compactBlockReason(c, on)).toBe(out);
  });
});

describe("needsAutoCompaction", () => {
  it("вход достиг окна — нужно; авто выключено — нет", () => {
    expect(needsAutoCompaction(ctx(), untrimmed(ctx()), true)).toBe(true);
    const off = ctx({ settings: { compactAutoEnabled: false } });
    expect(needsAutoCompaction(off, untrimmed(off), true)).toBe(false);
  });

  it("вход меньше окна — не нужно", () => {
    const big = ctx({ preset: { contextSize: 100000 } });
    expect(needsAutoCompaction(big, untrimmed(big), true)).toBe(false);
  });
});

describe("planStoryCompaction", () => {
  it("якорь — бит, живой ход не сжимается, покрытие считает и директивы", () => {
    const c = ctx();
    const { segments, floor } = planStoryCompaction(c, untrimmed(c));
    expect(floor).toBe(1000);
    expect(segments.length).toBeGreaterThan(0);
    for (const s of segments) {
      expect([1, 3, 5]).toContain(s.anchorId);
      expect(s.beatTexts.every((t) => t === LONG)).toBe(true);
    }
    expect(segments.at(-1)!.anchorId).not.toBe(6);
    expect(segments.reduce((n, s) => n + s.coveredCount, 0)).toBeLessThan(path.length);
  });

  it("вход уже ниже пола — сжимать нечего", () => {
    const c = ctx({ preset: { contextSize: 100000 }, settings: { compactFloorTokens: 90000 } });
    expect(planStoryCompaction(c, untrimmed(c)).segments).toEqual([]);
  });

  it("promptTokens считает overhead на каждое сообщение", () => {
    expect(promptTokens([{ role: "user", content: "" }])).toBeGreaterThan(0);
  });
});

describe("промпт сжатия", () => {
  it("дефолт с подставленным числом слов; прошлые пересказы — отдельным system", () => {
    const prompt = compactionPrompt(null, 150);
    expect(prompt).toBe(DEFAULT_COMPACTION_PROMPT.replaceAll("{{words}}", "150"));
    expect(compactionRequest(prompt, [], ["a", "b"]).map((m) => m.role)).toEqual(["system", "user"]);
    const withPrior = compactionRequest(prompt, ["было"], ["a"]);
    expect(withPrior.map((m) => m.role)).toEqual(["system", "system", "user"]);
    expect(withPrior[1]!.content).toContain("было");
    expect(withPrior[2]!.content).toBe("a");
  });

  it("свой промпт шаблона", () => {
    expect(compactionPrompt({ compactionPrompt: " Кратко, {{words}} слов " } as NarratorTemplate, 50)).toBe("Кратко, 50 слов");
  });
});
