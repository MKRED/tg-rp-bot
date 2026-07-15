import { describe, expect, it } from "vitest";
import { hasUnsavedChanges, normalizePersonaDraft, type PersonaFormDraft } from "./formDirty";

const baseDraft: PersonaFormDraft = {
  name: "Алиса",
  image: null,
  imageFull: null,
  footnote: "заметка",
  prompt: "Промпт",
};

describe("normalizePersonaDraft", () => {
  it("трим имени, пустой footnote в null", () => {
    expect(
      normalizePersonaDraft({
        ...baseDraft,
        name: "  Алиса  ",
        footnote: "   ",
      }),
    ).toEqual({
      name: "Алиса",
      image: null,
      imageFull: null,
      footnote: null,
      prompt: "Промпт",
    });
  });
});

describe("hasUnsavedChanges", () => {
  it("false, когда черновик после нормализации совпадает с baseline", () => {
    const baseline = normalizePersonaDraft(baseDraft);
    expect(hasUnsavedChanges({ ...baseDraft, name: "  Алиса  " }, baseline)).toBe(false);
  });

  it("true, когда есть реальное отличие", () => {
    const baseline = normalizePersonaDraft(baseDraft);
    expect(hasUnsavedChanges({ ...baseDraft, prompt: "Другой промпт" }, baseline)).toBe(true);
  });
});
