/**
 * Типы компонентов промптов — вынесены из schema.ts (там остаются только определения таблиц).
 * Используются как `.$type<…>()` колонок prompt_order и валидацией/билдерами промптов.
 */

/** Компонент запроса к нейросети, чей порядок и включённость настраиваются в пресете. */
export type PromptComponentId =
  | "system"
  | "characterDescription"
  | "characterScenario"
  | "userDescription"
  | "auxiliary"
  | "history"
  | "postHistory";

/** Элемент порядка промптов: какой компонент и включён ли он в запрос. */
export type PromptOrderItem = { id: PromptComponentId; enabled: boolean };

/** Компонент narrator-запроса, чей порядок и включённость настраиваются в шаблоне. */
export type StoryPromptComponentId =
  | "system"
  | "premise"
  | "lorebook"
  | "auxiliary"
  | "compact"
  | "history"
  | "postHistory";

/** Элемент порядка narrator-промптов: какой компонент и включён ли он в запрос. */
export type StoryPromptOrderItem = { id: StoryPromptComponentId; enabled: boolean };
