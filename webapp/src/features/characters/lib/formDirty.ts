import type { CharacterInput } from "../types/character";

/** Черновик формы — тот же набор полей, что и локальный стейт CharacterForm. */
export type CharacterFormDraft = {
  name: string;
  image: string | null;
  imageFull: string | null;
  tags: string[];
  footnote: string;
  prompt: string;
  scenario: string;
  firstMessages: string[];
};

/** Нормализация черновика под сравнение — тот же trim/null-протокол, что при сохранении (handleSubmit). */
export function normalizeCharacterDraft(draft: CharacterFormDraft): CharacterInput {
  return {
    name: draft.name.trim(),
    image: draft.image,
    imageFull: draft.imageFull,
    tags: draft.tags,
    footnote: draft.footnote.trim() || null,
    prompt: draft.prompt,
    scenario: draft.scenario,
    firstMessages: draft.firstMessages.map((m) => m.trim()).filter(Boolean),
  };
}

/** Есть ли несохранённые изменения — сравнение нормализованных payload по значению. */
export function hasUnsavedChanges(current: CharacterFormDraft, baseline: CharacterInput): boolean {
  return JSON.stringify(normalizeCharacterDraft(current)) !== JSON.stringify(baseline);
}
