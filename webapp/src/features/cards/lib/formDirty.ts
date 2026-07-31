import type { CardCategory, CardInput } from "../types/card";

/** Черновик формы — тот же набор полей, что и локальный стейт CardForm. */
export type CardFormDraft = {
  name: string;
  systemPrompt: string;
  prompt: string;
  categories: CardCategory[];
  presetId: number | null;
};

/** Нормализация черновика под сравнение — тот же протокол, что при сохранении (handleSubmit). */
export function normalizeCardDraft(draft: CardFormDraft): CardInput {
  return {
    name: draft.name.trim(),
    systemPrompt: draft.systemPrompt,
    prompt: draft.prompt,
    categories: draft.categories,
    presetId: draft.presetId,
  };
}

/** Есть ли несохранённые изменения — сравнение нормализованных payload по значению. */
export function hasUnsavedChanges(current: CardFormDraft, baseline: CardInput): boolean {
  return JSON.stringify(normalizeCardDraft(current)) !== JSON.stringify(baseline);
}
