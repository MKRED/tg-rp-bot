/**
 * Типы компонентов промптов — вынесены из schema.ts (там остаются только определения таблиц).
 * Используются как `.$type<…>()` колонок prompt_order и валидацией/билдерами промптов.
 */

// Компоненты RP- и narrator-запроса — часть контракта API, живут в @tg-rp-bot/shared.
export type {
  PromptComponentId,
  PromptOrderItem,
  StoryPromptComponentId,
  StoryPromptOrderItem,
} from "@tg-rp-bot/shared";

// Категория карточки и состояние ask_user на ней — часть контракта API, живут в @tg-rp-bot/shared
// (там же — почему ask_user хранится на категории, а не в памяти процесса).
export type { AskUserAnswer, AskUserQuestion, CardCategory } from "@tg-rp-bot/shared";
