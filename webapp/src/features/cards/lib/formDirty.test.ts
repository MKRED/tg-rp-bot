import { describe, expect, it } from "vitest";
import { hasUnsavedChanges, normalizeCardDraft, type CardFormDraft } from "./formDirty";

const baseDraft: CardFormDraft = {
  name: "Алиса",
  systemPrompt: "Системные инструкции",
  prompt: "Промпт",
  categories: [
    { id: "base", title: "Base", description: "Name: ...", content: "", enabled: true },
  ],
  presetId: 1,
  useWebSearch: false,
  useAskUser: false,
};

describe("normalizeCardDraft", () => {
  it("трим имени, остальные поля без изменений", () => {
    expect(normalizeCardDraft({ ...baseDraft, name: "  Алиса  " })).toEqual({
      name: "Алиса",
      systemPrompt: "Системные инструкции",
      prompt: "Промпт",
      categories: baseDraft.categories,
      presetId: 1,
      useWebSearch: false,
      useAskUser: false,
    });
  });
});

describe("hasUnsavedChanges", () => {
  it("false, когда черновик после нормализации совпадает с baseline", () => {
    const baseline = normalizeCardDraft(baseDraft);
    expect(hasUnsavedChanges({ ...baseDraft, name: "  Алиса  " }, baseline)).toBe(false);
  });

  it("true, когда есть реальное отличие в промпте", () => {
    const baseline = normalizeCardDraft(baseDraft);
    expect(hasUnsavedChanges({ ...baseDraft, prompt: "Другой промпт" }, baseline)).toBe(true);
  });

  it("true, когда изменилась структура категорий (например content после генерации)", () => {
    const baseline = normalizeCardDraft(baseDraft);
    const changed = {
      ...baseDraft,
      categories: [{ ...baseDraft.categories[0]!, content: "Сгенерированный текст" }],
    };
    expect(hasUnsavedChanges(changed, baseline)).toBe(true);
  });

  it("true, когда изменился presetId", () => {
    const baseline = normalizeCardDraft(baseDraft);
    expect(hasUnsavedChanges({ ...baseDraft, presetId: 2 }, baseline)).toBe(true);
  });
});
