/** Уровни рассуждения OpenRouter (по возрастанию бюджета). */
export type ReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh";
export const REASONING_EFFORTS: ReasoningEffort[] = [
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
];

/** Человекочитаемые подписи уровней рассуждения. */
export const REASONING_EFFORT_LABELS: Record<ReasoningEffort, string> = {
  minimal: "Минимальное",
  low: "Низкое",
  medium: "Среднее",
  high: "Высокое",
  xhigh: "Максимальное",
};

/**
 * Тело формы создания/правки (POST/PUT). Параметры сэмплинга — `number | null`,
 * где null = «не передавать значение». Имена совпадают с колонками БД и телом OpenRouter.
 * Промпты RP-чата живут отдельно — в фиче rp-templates (пресет режимо-независим, общий
 * для RP-чата и Narrator).
 */
export interface PresetInput {
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
  reasoningEffort: ReasoningEffort | null;
}

/** Полный пресет, как его отдаёт сервер (GET /presets/:id). */
export interface Preset extends PresetInput {
  id: number;
  createdAt: string;
  updatedAt: string;
}

/** Лёгкая строка списка (GET /presets): id, название + поля для сводки под названием. */
export interface PresetListItem {
  id: number;
  name: string;
  temperature: number | null;
  contextUnlimited: boolean;
  contextSize: number | null;
  maxTokens: number | null;
  streaming: boolean;
  requestReasoning: boolean;
  reasoningEffort: ReasoningEffort | null;
}

/** Мягкий лимит — дублирует серверный (bot/src/server/presets/presets.constants.ts), блокирует UI заранее. */
export const MAX_PRESETS_PER_USER = 50;
