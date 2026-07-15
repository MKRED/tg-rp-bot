import type { PromptOrderItem } from "../schema.js";

/**
 * Поля RP-шаблона из формы Mini App. Тексты промптов + порядок сборки — сэмплинг живёт в
 * generation_presets. Не шифруется (как и пресеты — systemPrompt там в открытом виде).
 */
export type RpTemplateInput = {
  name: string;
  systemPrompt: string;
  auxiliarySystemPrompt: string;
  postHistoryInstruction: string;
  userPersonaPrompt: string;
  userPersonaStreaming: boolean;
  translationSystemPrompt: string;
  promptOrder: PromptOrderItem[];
};

/** Лёгкая строка списка RP-шаблонов. */
export type RpTemplateListItem = {
  id: number;
  name: string;
};
