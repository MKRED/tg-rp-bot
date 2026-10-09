// Контракт API RP-шаблонов (/api/rp-templates) — общий для bot и webapp.

/**
 * Канонический набор компонентов RP-запроса к нейросети, чей порядок и включённость настраиваются
 * в шаблоне. promptOrder обязан содержать ровно их, каждый по разу.
 */
export const PROMPT_COMPONENT_IDS = [
  "system",
  "characterDescription",
  "characterScenario",
  "userDescription",
  "auxiliary",
  "history",
  "postHistory",
] as const;
export type PromptComponentId = (typeof PROMPT_COMPONENT_IDS)[number];

/** Элемент порядка промптов: какой компонент и включён ли он в запрос. */
export interface PromptOrderItem {
  id: PromptComponentId;
  enabled: boolean;
}

/**
 * Тело формы создания/правки (POST/PUT): тексты промптов + порядок сборки. Сэмплинг живёт
 * отдельно — в пресете генерации.
 */
export interface RpTemplateInput {
  name: string;
  systemPrompt: string;
  auxiliarySystemPrompt: string;
  postHistoryInstruction: string;
  userPersonaPrompt: string;
  userPersonaStreaming: boolean;
  translationSystemPrompt: string;
  promptOrder: PromptOrderItem[];
}

/** Лёгкая строка списка (GET /rp-templates): без текстов промптов, только их вес в токенах. */
export interface RpTemplateListItem {
  id: number;
  name: string;
  /** ISO-строка. */
  updatedAt: string;
  /** Вес трёх template-полей (system/auxiliary/postHistory) в токенах, точный подсчёт с сервера. */
  templateTokens: number;
}

// Мягкий лимит: webapp блокирует UI заранее, сервер проверяет последней линией защиты.
export const MAX_RP_TEMPLATES_PER_USER = 50;
