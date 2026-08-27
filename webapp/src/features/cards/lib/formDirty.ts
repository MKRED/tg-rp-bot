import type { CardCategory, CardInput } from "../types/card";

/** Черновик формы — тот же набор полей, что и локальный стейт CardForm. */
export type CardFormDraft = {
  name: string;
  systemPrompt: string;
  prompt: string;
  categories: CardCategory[];
  presetId: number | null;
  useWebSearch: boolean;
  useAskUser: boolean;
};

/**
 * Нормализация черновика под сравнение — тот же протокол, что при сохранении (handleSubmit).
 * categories явно перечисляет поля: pendingQuestions/askUserAnswers — состояние ask_user, которое
 * сервер сам подставляет и обновляет вне формы (см. CardCategory в types/card.ts) — если сравнивать
 * их тоже, ответ модели ask_user на "Сгенерировать" мгновенно пометил бы форму как "изменена" и на
 * следующий клик показал бы ложное предупреждение «сохранить перед генерацией» поверх PUT со
 * устаревшими данными формы (бэкенд их всё равно проигнорирует, но диалог лишний и пугающий).
 */
export function normalizeCardDraft(draft: CardFormDraft): CardInput {
  return {
    name: draft.name.trim(),
    systemPrompt: draft.systemPrompt,
    prompt: draft.prompt,
    categories: draft.categories.map(({ id, title, description, content, enabled }) => ({
      id,
      title,
      description,
      content,
      enabled,
    })),
    presetId: draft.presetId,
    useWebSearch: draft.useWebSearch,
    useAskUser: draft.useAskUser,
  };
}

/** Есть ли несохранённые изменения — сравнение нормализованных payload по значению. */
export function hasUnsavedChanges(current: CardFormDraft, baseline: CardInput): boolean {
  return JSON.stringify(normalizeCardDraft(current)) !== JSON.stringify(baseline);
}
