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
  promptOrder: StoryPromptOrderItem[];
};

/** Лёгкая строка списка шаблонов. */
export type NarratorTemplateListItem = {
  id: number;
  name: string;
};
