import type { PromptOrderItem } from "../schema.js";

/**
 * Поля пресета, приходящие из формы Mini App (без серверных id/timestamps). Параметры сэмплинга —
 * `number | null`, где null = «не передавать значение». Имена совпадают с колонками БД и с будущим
 * телом запроса к OpenRouter, чтобы маппинг при подключении генерации был тривиальным.
 */
export type PresetInput = {
  name: string;
  contextUnlimited: boolean;
  contextSize: number | null;
  maxTokens: number | null;
  streaming: boolean;
  temperature: number | null;
  topP: number | null;
  topK: number | null;
  frequencyPenalty: number | null;
  presencePenalty: number | null;
  repetitionPenalty: number | null;
  minP: number | null;
  topA: number | null;
  systemPrompt: string;
  auxiliarySystemPrompt: string;
  postHistoryInstruction: string;
  userPersonaPrompt: string;
  userPersonaStreaming: boolean;
  translationSystemPrompt: string;
  requestReasoning: boolean;
  reasoningEffort: string | null;
  promptOrder: PromptOrderItem[];
};

/**
 * Лёгкая строка списка: id, название и несколько скалярных полей для сводки под названием
 * (температура, лимиты, стриминг, рассуждение). Тексты промптов и остальной сэмплинг не тянем —
 * они нужны только в форме правки.
 */
export type PresetListItem = {
  id: number;
  name: string;
  temperature: number | null;
  contextUnlimited: boolean;
  contextSize: number | null;
  maxTokens: number | null;
  streaming: boolean;
  requestReasoning: boolean;
  reasoningEffort: string | null;
};
