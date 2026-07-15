/**
 * Поля пресета, приходящие из формы Mini App (без серверных id/timestamps). Параметры сэмплинга —
 * `number | null`, где null = «не передавать значение». Имена совпадают с колонками БД и с телом
 * запроса к OpenRouter, чтобы маппинг был тривиальным. Промпты живут отдельно — в RP-шаблоне
 * (rp_templates) или narrator-шаблоне (narrator_templates); пресет режимо-независим.
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
  requestReasoning: boolean;
  reasoningEffort: string | null;
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
