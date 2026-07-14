import { describe, expect, it } from "vitest";
import { hasUnsavedChanges, normalizeCharacterDraft, type CharacterFormDraft } from "./formDirty";

const baseDraft: CharacterFormDraft = {
  name: "Алиса",
  image: null,
  imageFull: null,
  tags: ["fantasy"],
  footnote: "заметка",
  prompt: "Промпт",
  scenario: "Сценарий",
  firstMessages: ["Привет"],
};

describe("normalizeCharacterDraft", () => {
  it("трим имени, пустой footnote в null, отбрасывает пустые firstMessages", () => {
    expect(
      normalizeCharacterDraft({
        ...baseDraft,
        name: "  Алиса  ",
        footnote: "   ",
        firstMessages: ["Привет", "  ", ""],
      }),
    ).toEqual({
      name: "Алиса",
      image: null,
      imageFull: null,
      tags: ["fantasy"],
      footnote: null,
      prompt: "Промпт",
      scenario: "Сценарий",
      firstMessages: ["Привет"],
    });
  });
});

describe("hasUnsavedChanges", () => {
  it("false, когда черновик после нормализации совпадает с baseline", () => {
    const baseline = normalizeCharacterDraft(baseDraft);
    expect(hasUnsavedChanges({ ...baseDraft, name: "  Алиса  " }, baseline)).toBe(false);
  });

  it("true, когда есть реальное отличие", () => {
    const baseline = normalizeCharacterDraft(baseDraft);
    expect(hasUnsavedChanges({ ...baseDraft, prompt: "Другой промпт" }, baseline)).toBe(true);
  });
});
