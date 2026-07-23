import type { StoryPromptOrderItem } from "../schema.js";

/**
 * Поля narrator-шаблона из формы Mini App. Тексты промптов + порядок сборки — сэмплинг живёт в
 * generation_presets. Не шифруется (как и пресеты — systemPrompt там в открытом виде).
 */
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

/** Лёгкая строка списка шаблонов, как отдаётся клиенту (без текста промптов). */
export type NarratorTemplateListItem = {
  id: number;
  name: string;
  updatedAt: Date;
  templateTokens: number;
};

/**
 * Сырая строка DAO для списка — текстовые поля и promptOrder нужны только чтобы посчитать
 * templateTokens на сервере (narratorTemplates.controller.ts), клиенту не уходят.
 */
export type NarratorTemplateListRow = {
  id: number;
  name: string;
  updatedAt: Date;
  systemPrompt: string;
  auxiliarySystemPrompt: string;
  postHistoryInstruction: string;
  promptOrder: StoryPromptOrderItem[];
};
