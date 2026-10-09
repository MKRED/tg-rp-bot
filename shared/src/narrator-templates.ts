// Контракт API narrator-шаблонов (/api/narrator-templates) — общий для bot и webapp.
import { REASONING_EFFORTS } from "./presets.js";

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
export interface StoryPromptOrderItem {
  id: StoryPromptComponentId;
  enabled: boolean;
}

/**
 * Дефолтный порядок narrator-компонентов (он же — канонический набор): дефолт колонки prompt_order,
 * форма нового шаблона, серверный фолбэк при отсутствии поля и для истории без шаблона.
 * premise идёт после auxiliary; compact — перед history; postHistory выключен.
 */
export const DEFAULT_NARRATOR_PROMPT_ORDER: StoryPromptOrderItem[] = [
  { id: "system", enabled: true },
  { id: "lorebook", enabled: true },
  { id: "auxiliary", enabled: true },
  { id: "premise", enabled: true },
  { id: "compact", enabled: true },
  { id: "history", enabled: true },
  { id: "postHistory", enabled: false },
];

/**
 * Уровень рассуждения ИИ-перевода, независимо от пресета: "off" — рассуждение для перевода
 * выключено, иначе — форсированный уровень effort.
 */
export const TRANSLATION_REASONING_LEVELS = ["off", ...REASONING_EFFORTS] as const;
export type TranslationReasoningLevel = (typeof TRANSLATION_REASONING_LEVELS)[number];

/** Дефолт narrator_templates.translation_reasoning_effort (колонка обязательна). */
export const DEFAULT_TRANSLATION_REASONING_EFFORT: TranslationReasoningLevel = "medium";

/** Тело формы создания/правки (POST/PUT): тексты промптов, маркеры сборки, порядок и флаги. */
export interface NarratorTemplateInput {
  name: string;
  systemPrompt: string;
  auxiliarySystemPrompt: string;
  postHistoryInstruction: string;
  translationSystemPrompt: string;
  compactionPrompt: string;
  continueMarker: string;
  leadingUserMarker: string;
  promptOrder: StoryPromptOrderItem[];
  mergeSystemPrompts: boolean;
  translationReasoningEffort: TranslationReasoningLevel;
  /** Переводить ИИ-режимом по абзацам параллельно, а не текст целиком. */
  translatePerParagraph: boolean;
}

/** Лёгкая строка списка (GET /narrator-templates): без текстов промптов, только их вес в токенах. */
export interface NarratorTemplateListItem {
  id: number;
  name: string;
  /** ISO-строка. */
  updatedAt: string;
  /** Вес трёх template-полей (system/auxiliary/postHistory) в токенах, точный подсчёт с сервера. */
  templateTokens: number;
}

/** Максимальная длина названия: длиннее — молча усекается сервером. */
export const MAX_NARRATOR_TEMPLATE_NAME_CHARS = 100;

// Мягкий лимит: webapp блокирует UI заранее, сервер проверяет последней линией защиты.
export const MAX_NARRATOR_TEMPLATES_PER_USER = 50;
