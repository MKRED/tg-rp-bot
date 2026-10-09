// Контракт /api/settings — персональные настройки пользователя: ключ/модель DeepSeek и ключ Tavily
// (BYOK — сами ключи сервер никогда не отдаёт), настройки режима перевода PromptEditorOverlay.
import { TRANSLATION_REASONING_LEVELS } from "./narrator-templates.js";

/** Результат «Проверить ключ»: ok:false — штатный исход (200), а не ошибка транспорта. */
export type VerifyKeyError = "invalid_key" | "no_key";

// ── DeepSeek (/settings/llm) ───────────────────────────────────────────────────────────────────

export interface LlmSettingsStatus {
  hasKey: boolean;
  /** Последние 4 символа ключа — для UI ("ключ сохранён, оканчивается на …ab12"), сам ключ не отдаём. */
  last4: string | null;
  model: string | null;
}

export interface LlmSettingsPatch {
  /** undefined — не трогать сохранённый ключ; null — удалить (вместе с моделью); string — задать новый. */
  apiKey?: string | null;
  model?: string;
}

export interface VerifyDeepSeekKeyResult {
  ok: boolean;
  models?: string[];
  error?: VerifyKeyError;
}

export interface DeepSeekBalanceInfo {
  currency: string;
  totalBalance: string;
  grantedBalance: string;
  toppedUpBalance: string;
}

export interface DeepSeekBalance {
  /** Хватает ли баланса на API-запросы. */
  isAvailable: boolean;
  balanceInfos: DeepSeekBalanceInfo[];
}

// ── Tavily (/settings/tavily) ──────────────────────────────────────────────────────────────────

/**
 * Лимит раундов tool-calling подряд за одну генерацию с веб-поиском. Верхняя граница держит
 * длительность генерации в разумных пределах: каждый раунд — отдельный вызов DeepSeek + поиск,
 * а генерация блока карточки не стримится. Кламп в этот диапазон делает сервер.
 */
export const MIN_SEARCH_ROUNDS = 1;
export const MAX_SEARCH_ROUNDS = 8;
export const DEFAULT_SEARCH_ROUNDS = 4;

export interface TavilySettingsStatus {
  hasKey: boolean;
  /** Последние 4 символа ключа — для UI, сам ключ не отдаём. */
  last4: string | null;
  maxSearchRounds: number;
}

export interface TavilySettingsPatch {
  /** undefined — не трогать сохранённый ключ; null — удалить; string — задать новый. */
  apiKey?: string | null;
  /** undefined — не трогать лимит раундов; иначе новое значение (кламп — на сервере). */
  maxSearchRounds?: number;
}

export interface TavilyUsage {
  plan: string;
  planUsage: number;
  planLimit: number | null;
}

export interface VerifyTavilyKeyResult {
  ok: boolean;
  usage?: TavilyUsage;
  error?: VerifyKeyError;
}

// ── Режим перевода PromptEditorOverlay (/settings/translate) ───────────────────────────────────

/**
 * Уровни reasoning ИИ-перевода — тот же набор, что у перевода narrator-шаблона, но отдельная
 * настройка (user_settings, не шаблон). Дефолт "off": этот путь делает много мелких пер-абзацных
 * вызовов за одно действие, без рассуждений он быстрее.
 */
export const PROMPT_TRANSLATE_REASONING_LEVELS = TRANSLATION_REASONING_LEVELS;
export type PromptTranslateReasoningEffort = (typeof PROMPT_TRANSLATE_REASONING_LEVELS)[number];
export const DEFAULT_PROMPT_TRANSLATE_REASONING_EFFORT: PromptTranslateReasoningEffort = "off";

export const PROMPT_TRANSLATE_ENGINES = ["google", "ai"] as const;
export type PromptTranslateEngine = (typeof PROMPT_TRANSLATE_ENGINES)[number];

export interface TranslateSettings {
  engine: PromptTranslateEngine;
  targetLang: string;
  /** null — свой промпт не задан, сервер использует дефолтный шаблон. */
  promptTemplate: string | null;
  reasoningEffort: PromptTranslateReasoningEffort;
}

export interface TranslateSettingsPatch {
  engine?: PromptTranslateEngine;
  targetLang?: string;
  /** undefined — не трогать; null — сбросить на дефолтный промпт; string — задать свой. */
  promptTemplate?: string | null;
  reasoningEffort?: PromptTranslateReasoningEffort;
}
