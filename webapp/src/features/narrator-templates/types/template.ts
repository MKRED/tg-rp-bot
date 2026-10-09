/** Типы фичи «narrator-шаблоны» — источник промптов и порядка сборки narrator-режима. */

// Контракт формы/списка, компоненты, дефолтный порядок, уровни рассуждения перевода и лимит —
// общие с сервером, живут в пакете @tg-rp-bot/shared.
import type { StoryPromptComponentId, StoryPromptOrderItem, TranslationReasoningLevel } from "@tg-rp-bot/shared";

export type {
  NarratorTemplateInput,
  NarratorTemplateListItem,
  StoryPromptComponentId,
  StoryPromptOrderItem,
  TranslationReasoningLevel,
} from "@tg-rp-bot/shared";
export {
  DEFAULT_NARRATOR_PROMPT_ORDER,
  DEFAULT_TRANSLATION_REASONING_EFFORT,
  MAX_NARRATOR_TEMPLATES_PER_USER,
  TRANSLATION_REASONING_LEVELS,
} from "@tg-rp-bot/shared";

/** Подписи компонентов для блока «Порядок промптов». */
export const NARRATOR_PROMPT_COMPONENT_LABELS: Record<StoryPromptComponentId, string> = {
  system: "Инструкция нарратора",
  premise: "Вводная истории",
  lorebook: "Книга знаний",
  auxiliary: "Вспомогательный промпт",
  compact: "Краткое содержание",
  history: "Лента истории",
  postHistory: "Инструкция после истории",
};

/** Откуда берётся каждый компонент — подпись под названием, чтобы пользователь понимал источник. */
export const NARRATOR_PROMPT_COMPONENT_SOURCES: Record<StoryPromptComponentId, string> = {
  system: "из этого шаблона",
  premise: "из истории",
  lorebook: "из книги знаний истории",
  auxiliary: "из этого шаблона",
  compact: "пересказы сжатых сообщений",
  history: "сообщения истории",
  postHistory: "из этого шаблона",
};

/** Подписи уровней рассуждения перевода. */
export const TRANSLATION_REASONING_LABELS: Record<TranslationReasoningLevel, string> = {
  off: "Отключено",
  minimal: "Минимальное",
  low: "Низкое",
  medium: "Среднее",
  high: "Высокое",
  xhigh: "Очень высокое",
  max: "Максимальное",
  ultra: "Ультра",
};

export type NarratorTemplate = {
  id: number;
  name: string;
  systemPrompt: string;
  auxiliarySystemPrompt: string;
  postHistoryInstruction: string;
  translationSystemPrompt: string;
  compactionPrompt: string;
  continueMarker: string;
  leadingUserMarker: string;
  promptOrder: StoryPromptOrderItem[];
  mergeSystemPrompts: boolean;
  translationReasoningEffort: TranslationReasoningLevel;
  /** Переводить ИИ-режимом по абзацам параллельно, а не текст целиком (см. bot/src/db/schema.ts). */
  translatePerParagraph: boolean;
};

/** Дефолты маркеров — зеркало bot/src/server/prompt/storyPromptBuilder.constants.ts, для новой формы. */
export const DEFAULT_CONTINUE_MARKER = "Continue the story.";
export const DEFAULT_LEADING_USER_MARKER = "Begin the story.";
