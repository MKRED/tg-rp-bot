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

/** Компонент запроса к нейросети, чей порядок и включённость настраиваются в пресете. */
export type PromptComponentId =
  | "system"
  | "characterDescription"
  | "characterScenario"
  | "userDescription"
  | "auxiliary"
  | "history"
  | "postHistory";

export interface PromptOrderItem {
  id: PromptComponentId;
  enabled: boolean;
}

/** Подписи компонентов запроса для блока «Порядок промптов». */
export const PROMPT_COMPONENT_LABELS: Record<PromptComponentId, string> = {
  system: "Основной промпт",
  characterDescription: "Описание персонажа",
  characterScenario: "Сценарий",
  userDescription: "Описание пользователя",
  auxiliary: "Вспомогательный промпт",
  history: "История чата",
  postHistory: "Инструкция после истории",
};

/** Откуда берётся каждый компонент — подпись под названием, чтобы пользователь понимал источник. */
export const PROMPT_COMPONENT_SOURCES: Record<PromptComponentId, string> = {
  system: "из этого пресета",
  characterDescription: "из карточки персонажа · Промпт",
  characterScenario: "из карточки персонажа · Сценарий",
  userDescription: "из персоны · Промпт",
  auxiliary: "из этого пресета",
  history: "сообщения чата",
  postHistory: "из этого пресета",
};

/** Компоненты, ещё не реализованные как часть запроса — строку показываем неактивной. */
export const UNIMPLEMENTED_COMPONENTS: PromptComponentId[] = [];

/** Дефолтный порядок и включённость (userDescription выключен — пользователь включает вручную). */
export const DEFAULT_PROMPT_ORDER: PromptOrderItem[] = [
  { id: "system", enabled: true },
  { id: "characterDescription", enabled: true },
  { id: "userDescription", enabled: false },
  { id: "auxiliary", enabled: true },
  { id: "characterScenario", enabled: false },
  { id: "history", enabled: true },
  { id: "postHistory", enabled: true },
];

/**
 * Тело формы создания/правки (POST/PUT). Параметры сэмплинга — `number | null`,
 * где null = «не передавать значение». Имена совпадают с колонками БД и телом OpenRouter.
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
  systemPrompt: string;
  auxiliarySystemPrompt: string;
  postHistoryInstruction: string;
  userPersonaPrompt: string;
  userPersonaStreaming: boolean;
  translationSystemPrompt: string;
  requestReasoning: boolean;
  reasoningEffort: ReasoningEffort | null;
  promptOrder: PromptOrderItem[];
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

/** Мягкий лимит — дублирует серверный (bot/src/server/presets.ts), блокирует UI заранее. */
export const MAX_PRESETS_PER_USER = 50;
