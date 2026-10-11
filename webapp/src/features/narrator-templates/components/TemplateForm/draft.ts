import {
  DEFAULT_CONTINUE_MARKER,
  DEFAULT_LEADING_USER_MARKER,
  DEFAULT_NARRATOR_PROMPT_ORDER,
  DEFAULT_TRANSLATION_REASONING_EFFORT,
  type NarratorTemplate,
  type NarratorTemplateInput,
} from "../../types/template";

/** Смена одного поля формы — общая для карточек, на которые разложена форма. */
export type SetDraftField = <K extends keyof NarratorTemplateInput>(key: K, value: NarratorTemplateInput[K]) => void;

/** Значения формы: из сохранённого шаблона или дефолты для нового (маркеры — как на сервере). */
export function toDraft(initial?: NarratorTemplate): NarratorTemplateInput {
  return {
    name: initial?.name ?? "",
    systemPrompt: initial?.systemPrompt ?? "",
    auxiliarySystemPrompt: initial?.auxiliarySystemPrompt ?? "",
    postHistoryInstruction: initial?.postHistoryInstruction ?? "",
    translationSystemPrompt: initial?.translationSystemPrompt ?? "",
    compactionPrompt: initial?.compactionPrompt ?? "",
    continueMarker: initial?.continueMarker ?? DEFAULT_CONTINUE_MARKER,
    leadingUserMarker: initial?.leadingUserMarker ?? DEFAULT_LEADING_USER_MARKER,
    promptOrder: initial?.promptOrder ?? DEFAULT_NARRATOR_PROMPT_ORDER,
    mergeSystemPrompts: initial?.mergeSystemPrompts ?? false,
    translationReasoningEffort: initial?.translationReasoningEffort ?? DEFAULT_TRANSLATION_REASONING_EFFORT,
    translatePerParagraph: initial?.translatePerParagraph ?? false,
  };
}
