/** Типы фичи «narrator-шаблоны» — источник промптов и порядка сборки narrator-режима. */

export type NarratorTemplateListItem = {
  id: number;
  name: string;
  updatedAt: string;
  /** Вес трёх template-полей (system/auxiliary/postHistory) в токенах, точный подсчёт с сервера. */
  templateTokens: number;
};

/**
 * Компонент narrator-запроса, чей порядок и включённость настраиваются в шаблоне.
 * Дублирует серверный `StoryPromptComponentId` (bot/src/db/schema.ts) — держать в синхроне.
 */
export type StoryPromptComponentId =
  | "system"
  | "premise"
  | "lorebook"
  | "auxiliary"
  | "compact"
  | "history"
  | "postHistory";

export interface StoryPromptOrderItem {
  id: StoryPromptComponentId;
  enabled: boolean;
}

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

/** Дефолтный порядок: premise после auxiliary; compact перед history; postHistory выключен. */
export const DEFAULT_NARRATOR_PROMPT_ORDER: StoryPromptOrderItem[] = [
  { id: "system", enabled: true },
  { id: "lorebook", enabled: true },
  { id: "auxiliary", enabled: true },
  { id: "premise", enabled: true },
  { id: "compact", enabled: true },
  { id: "history", enabled: true },
  { id: "postHistory", enabled: false },
];

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
};

export type NarratorTemplateInput = {
  name: string;
  systemPrompt: string;
  auxiliarySystemPrompt: string;
  postHistoryInstruction: string;
  translationSystemPrompt: string;
  compactionPrompt: string;
  continueMarker: string;
  leadingUserMarker: string;
  promptOrder: StoryPromptOrderItem[];
};

/** Дефолты маркеров — зеркало bot/src/server/prompt/storyPromptBuilder.constants.ts, для новой формы. */
export const DEFAULT_CONTINUE_MARKER = "Continue the story.";
export const DEFAULT_LEADING_USER_MARKER = "Begin the story.";

export const MAX_TEMPLATES_PER_USER = 50;
