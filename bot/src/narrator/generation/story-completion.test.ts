import type { StoryDetail, StoryMessage, StorySettings } from "@tg-rp-bot/shared";
import { describe, expect, it } from "vitest";
import type { GenerationPreset, NarratorTemplate } from "../../db/schema.js";
import type { PromptEntry } from "../../knowledge-books/entries/entries-prompt.repository.js";
import { DEFAULT_NARRATOR_PROMPT_ORDER, DEFAULT_NARRATOR_TEMPLATE } from "../../prompt/storyPromptBuilder/index.js";
import type { CompactionRow } from "../compaction/compactions.repository.js";
import { buildStoryCompletion, type StoryContext, selectLorebook } from "./story-completion.js";

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

const path = [
  msg(1, "assistant", "beat", "Открытие: дракон спит."),
  msg(2, "user", "directive", "рыцарь входит"),
  msg(3, "assistant", "beat", "Рыцарь входит в пещеру."),
  msg(4, "user", "directive", "дракон просыпается"),
];

const story = { id: 7, premise: "Средневековье", activeMessageId: 4, messages: path } as unknown as StoryDetail;
const settings = { compactEnabled: true } as StorySettings;
const compactOn = DEFAULT_NARRATOR_PROMPT_ORDER.map((i) => (i.id === "compact" ? { ...i, enabled: true } : i));
const template = (over: Partial<NarratorTemplate> = {}) =>
  ({ systemPrompt: "Ты рассказчик.", promptOrder: compactOn, auxiliarySystemPrompt: "", postHistoryInstruction: "", continueMarker: "", leadingUserMarker: "", ...over }) as NarratorTemplate;
const compaction = { id: 1, seq: 0, fromAnchorId: null, toAnchorId: 3, summary: "Рыцарь пришёл к дракону.", coveredCount: 3, coveredTokens: 30, createdAt: "" } as CompactionRow;
const ctx = (over: Partial<StoryContext> = {}): StoryContext => ({
  story,
  template: template(),
  preset: null,
  settings,
  compactions: [compaction],
  entries: [],
  ...over,
});
const text = (c: StoryContext) => buildStoryCompletion(c).msgs.map((m) => m.content).join("\n");

describe("buildStoryCompletion", () => {
  it("пересказ применяется: сжатые биты уходят из истории, пересказ — в запрос", () => {
    const out = text(ctx());
    expect(out).toContain("Рыцарь пришёл к дракону.");
    expect(out).not.toContain("Рыцарь входит в пещеру.");
    expect(out).toContain("дракон просыпается");
  });

  it("сжатие выключено в настройках — история целиком, пересказа нет", () => {
    const out = text(ctx({ settings: { compactEnabled: false } as StorySettings }));
    expect(out).not.toContain("Рыцарь пришёл к дракону.");
    expect(out).toContain("Рыцарь входит в пещеру.");
  });

  it("компонент compact выключен в шаблоне — пересказ не применяется, гейт сообщается", () => {
    const res = buildStoryCompletion(ctx({ template: template({ promptOrder: DEFAULT_NARRATOR_PROMPT_ORDER.map((i) => ({ ...i, enabled: i.id !== "compact" })) }) }));
    expect(res.compactComponentEnabled).toBe(false);
    expect(res.msgs.map((m) => m.content).join("\n")).toContain("Рыцарь входит в пещеру.");
  });

  it("без шаблона — дефолтная инструкция рассказчика; без пресета — пустой сэмплинг", () => {
    const res = buildStoryCompletion(ctx({ template: null }));
    expect(res.msgs.map((m) => m.content).join("\n")).toContain(DEFAULT_NARRATOR_TEMPLATE.slice(0, 40));
    expect(res.samplingOpts).toEqual({});
  });

  it("пресет — сэмплинг из него", () => {
    const res = buildStoryCompletion(ctx({ preset: { temperature: 0.5, maxTokens: 300 } as GenerationPreset }));
    expect(res.samplingOpts).toMatchObject({ temperature: 0.5, maxTokens: 300 });
  });
});

describe("selectLorebook", () => {
  const entry = (text: string, activation: PromptEntry["activation"], keywords: string[] = [], keywordDepth = 2): PromptEntry => ({
    text,
    activation,
    keywords,
    keywordDepth,
  });

  it("always_on — всегда; keyword — только если слово в последних keywordDepth сообщениях пути", () => {
    const contents = ["дракон спит", "рыцарь входит", "тишина"];
    const out = selectLorebook(
      [entry("A", "always_on"), entry("Рыцарь", "keyword", ["рыцарь"]), entry("Дракон", "keyword", ["дракон"]), entry("  ", "always_on")],
      contents,
    );
    expect(out).toEqual(["A", "Рыцарь"]);
  });
});
