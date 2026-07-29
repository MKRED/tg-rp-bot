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

/**
 * Категория карточки «Мастерской» (cards.categories) — редактируемый пользователем блок структуры
 * (например "Base", "Body"): title/description — то, что ИИ видит как заголовок и пример формата
 * (собирается в <example>…</example>), content — сгенерированный/отредактированный текст блока
 * (пусто = ещё не сгенерирован). Порядок генерации/сборки промпта = порядок элементов массива.
 * Все текстовые поля шифруются per-user в DAO (как prompt/footnote у characters), enabled/id — нет.
 */
export type CardCategory = {
  id: string;
  title: string;
  description: string;
  content: string;
  enabled: boolean;
};
