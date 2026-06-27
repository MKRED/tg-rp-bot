/** Типы фичи «narrator-шаблоны» — источник промптов и порядка сборки narrator-режима. */

export type NarratorTemplateListItem = {
  id: number;
  name: string;
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
  history: "Лента истории",
  postHistory: "Инструкция после истории",
};

/** Откуда берётся каждый компонент — подпись под названием, чтобы пользователь понимал источник. */
export const NARRATOR_PROMPT_COMPONENT_SOURCES: Record<StoryPromptComponentId, string> = {
  system: "из этого шаблона",
  premise: "из истории",
  lorebook: "из книги знаний истории",
  auxiliary: "из этого шаблона",
  history: "сообщения истории",
  postHistory: "из этого шаблона",
};

/** Дефолтный порядок: premise после auxiliary; postHistory выключен (включается вручную). */
export const DEFAULT_NARRATOR_PROMPT_ORDER: StoryPromptOrderItem[] = [
  { id: "system", enabled: true },
  { id: "lorebook", enabled: true },
  { id: "auxiliary", enabled: true },
  { id: "premise", enabled: true },
  { id: "history", enabled: true },
  { id: "postHistory", enabled: false },
];

export type NarratorTemplate = {
  id: number;
  name: string;
  systemPrompt: string;
  auxiliarySystemPrompt: string;
  postHistoryInstruction: string;
  promptOrder: StoryPromptOrderItem[];
};

export type NarratorTemplateInput = {
  name: string;
  systemPrompt: string;
  auxiliarySystemPrompt: string;
  postHistoryInstruction: string;
  promptOrder: StoryPromptOrderItem[];
};

export const MAX_TEMPLATES_PER_USER = 50;
