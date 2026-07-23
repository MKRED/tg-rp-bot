/** Типы фичи «RP-шаблоны» — источник промптов и порядка сборки RP-чата. */

export type RpTemplateListItem = {
  id: number;
  name: string;
  updatedAt: string;
  /** Вес трёх template-полей (system/auxiliary/postHistory) в токенах, точный подсчёт с сервера. */
  templateTokens: number;
};

/**
 * Компонент запроса к нейросети, чей порядок и включённость настраиваются в RP-шаблоне.
 * Дублирует серверный `PromptComponentId` (bot/src/db/schema.ts) — держать в синхроне.
 */
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
  system: "из этого шаблона",
  characterDescription: "из карточки персонажа · Промпт",
  characterScenario: "из карточки персонажа · Сценарий",
  userDescription: "из персоны · Промпт",
  auxiliary: "из этого шаблона",
  history: "сообщения чата",
  postHistory: "из этого шаблона",
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

export type RpTemplate = {
  id: number;
  name: string;
  systemPrompt: string;
  auxiliarySystemPrompt: string;
  postHistoryInstruction: string;
  userPersonaPrompt: string;
  userPersonaStreaming: boolean;
  translationSystemPrompt: string;
  promptOrder: PromptOrderItem[];
};

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

/** Мягкий лимит — дублирует серверный (bot/src/server/rp-templates/rpTemplates.constants.ts). */
export const MAX_RP_TEMPLATES_PER_USER = 50;
