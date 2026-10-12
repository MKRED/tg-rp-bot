import { describe, expect, it } from "vitest";
import type { StoryMessage, StorySettings } from "../types/story";
import { followsContinue, storyTranslateFlags, withStoryTranslation } from "./storyMessages";

const msg = (id: number, over: Partial<StoryMessage> = {}): StoryMessage => ({
  id,
  parentId: null,
  role: "assistant",
  kind: "beat",
  content: `m${id}`,
  translations: null,
  createdAt: "",
  siblingIndex: 0,
  siblingCount: 1,
  siblings: [id],
  ...over,
});

const settings = (over: Partial<StorySettings> = {}) =>
  ({
    translateEnabled: true,
    translateScope: "all",
    autoTranslateScope: "none",
    ...over,
  }) as StorySettings;

describe("withStoryTranslation", () => {
  it("добавляет перевод, не трогая другие языки и сообщения", () => {
    const list = [msg(1, { translations: { en: "hi" } }), msg(2)];
    const next = withStoryTranslation(list, 1, "de", "hallo");
    expect(next[0]?.translations).toEqual({ en: "hi", de: "hallo" });
    expect(next[1]).toBe(list[1]);
  });

  it("убирает перевод при null", () => {
    const next = withStoryTranslation([msg(1, { translations: { en: "hi", de: "x" } })], 1, "en", null);
    expect(next[0]?.translations).toEqual({ de: "x" });
  });
});

describe("storyTranslateFlags", () => {
  it("continue не переводится никогда", () => {
    const flags = storyTranslateFlags(settings({ autoTranslateScope: "all" }), { role: "user", kind: "continue" });
    expect(flags).toEqual({ button: false, autoShow: false });
  });

  it("scope по роли: директива — user, бит — assistant", () => {
    const s = settings({ translateScope: "assistant", autoTranslateScope: "user" });
    expect(storyTranslateFlags(s, { role: "assistant", kind: "beat" })).toEqual({ button: true, autoShow: false });
    expect(storyTranslateFlags(s, { role: "user", kind: "directive" })).toEqual({ button: false, autoShow: true });
  });

  it("перевод выключен — ничего", () => {
    const flags = storyTranslateFlags(settings({ translateEnabled: false, autoTranslateScope: "all" }), {
      role: "assistant",
      kind: "beat",
    });
    expect(flags).toEqual({ button: false, autoShow: false });
  });
});

describe("followsContinue", () => {
  it("смотрит на предыдущее сообщение по абсолютному индексу", () => {
    const list = [msg(1), msg(2, { role: "user", kind: "continue" }), msg(3)];
    expect(followsContinue(list, 2)).toBe(true);
    expect(followsContinue(list, 0)).toBe(false);
    expect(followsContinue(list, 3)).toBe(false);
    // Потоковый бит — индекс за концом ленты, последний ход — «Дальше».
    expect(followsContinue(list.slice(0, 2), 2)).toBe(true);
  });
});
