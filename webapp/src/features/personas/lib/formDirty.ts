import type { PersonaInput } from "../types/persona";

/** Черновик формы — тот же набор полей, что и локальный стейт PersonaForm. */
export type PersonaFormDraft = {
  name: string;
  image: string | null;
  imageFull: string | null;
  footnote: string;
  prompt: string;
};

/** Нормализация черновика под сравнение — тот же trim/null-протокол, что при сохранении (handleSubmit). */
export function normalizePersonaDraft(draft: PersonaFormDraft): PersonaInput {
  return {
    name: draft.name.trim(),
    image: draft.image,
    imageFull: draft.imageFull,
    footnote: draft.footnote.trim() || null,
    prompt: draft.prompt,
  };
}

/** Есть ли несохранённые изменения — сравнение нормализованных payload по значению. */
export function hasUnsavedChanges(current: PersonaFormDraft, baseline: PersonaInput): boolean {
  return JSON.stringify(normalizePersonaDraft(current)) !== JSON.stringify(baseline);
}
