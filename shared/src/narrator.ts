import type { AutoTranslateScope, MessageRole, TranslateScope } from "./rp-chat.js";
import type { PromptTranslateEngine } from "./settings.js";

/** Размер страницы списка историй по умолчанию и потолок (сервер приводит pageSize к 1..MAX). */
export const DEFAULT_STORIES_PAGE_SIZE = 20;
export const MAX_STORIES_PAGE_SIZE = 50;

/** Сервер обрезает название истории до этой длины (не 400). Премиза не обрезается. */
export const MAX_STORY_TITLE_LENGTH = 100;

/** Длина одного пересказа (compact) в словах: сервер приводит compactWords к этим границам. */
export const COMPACT_WORDS_MIN = 50;
export const COMPACT_WORDS_MAX = 800;

/**
 * «Пол» сжатия в токенах: нижняя граница и потолок как доля лимита контекста пресета. Сервер
 * клампит compactFloorTokens так же, как слайдер в webapp, — значения должны совпадать.
 */
export const COMPACT_FLOOR_MIN = 1000;
export const COMPACT_FLOOR_MAX_SHARE = 0.9;

/** beat — бит рассказчика; continue — «Дальше» (маркер); directive — режиссёрская директива. */
export const STORY_MESSAGE_KINDS = ["beat", "continue", "directive"] as const;
export type StoryMessageKind = (typeof STORY_MESSAGE_KINDS)[number];

/** Дескриптор аватара в стеке (AvatarStack) — источник записи книги знаний. */
export interface StoryAvatarRef {
  type: "character" | "persona";
  id: number;
  name: string;
  hasImage: boolean;
}

export interface StoryListItem {
  id: number;
  title: string | null;
  bookName: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  messageCount: number;
  createdAt: string;
  /** Топ-3 (сортировка книги) дескрипторов аватаров — для AvatarStack в списке. */
  avatars: StoryAvatarRef[];
}

/** Ответ GET /api/stories. */
export interface StoryListResponse {
  items: StoryListItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** Сообщение активного пути истории с информацией о сиблингах (для стрелок ← → в UI). */
export interface StoryMessage {
  id: number;
  parentId: number | null;
  role: MessageRole;
  kind: StoryMessageKind;
  content: string;
  /** Кэш переводов { lang: text }; null — переводов нет. */
  translations: Record<string, string> | null;
  createdAt: string;
  siblingIndex: number;
  siblingCount: number;
  siblings: number[];
}

export interface StoryDetail {
  id: number;
  title: string | null;
  /** Топ-5 (сортировка книги) дескрипторов аватаров — для AvatarStack в шапке. */
  book: { id: number; name: string; avatars: StoryAvatarRef[] };
  template: { id: number; name: string } | null;
  preset: { id: number; name: string } | null;
  premise: string;
  activeMessageId: number | null;
  messages: StoryMessage[];
}

/** Узел дерева истории для графа веток (плоский массив + флаг активного пути). */
export interface StoryTreeNode {
  id: number;
  parentId: number | null;
  role: MessageRole;
  kind: StoryMessageKind;
  content: string;
  isOnActivePath: boolean;
  /** Сообщение попало в диапазон какого-то пересказа — свёрнуто в summary (компонент compact). */
  isCompacted: boolean;
  createdAt: string;
}

/** Настройки истории (перевод + сжатие) — зеркало ChatSettings под narrator. */
export interface StorySettings {
  translateEnabled: boolean;
  translateTargetLang: string;
  /** На каких ходах показывать кнопку: all — все, assistant — биты ИИ, user — директивы. */
  translateScope: TranslateScope;
  autoTranslateScope: AutoTranslateScope;
  /** Метод перевода закэшированных сообщений (кнопка Globe): Google Translate либо ИИ. */
  translateMethod: PromptTranslateEngine;
  /** Сжатие истории (compact). */
  compactEnabled: boolean;
  compactAutoEnabled: boolean;
  /** Целевой «пол» в токенах (0 = не задано → дефолт на сервере). */
  compactFloorTokens: number;
  compactWords: number;
  /** Кнопка «откат к этому биту» в тулбаре сообщения (на всех битах ИИ, кроме последнего). */
  quickRollbackEnabled: boolean;
  /** Кнопка редактирования текста бита в тулбаре сообщения (правка на месте, без перегенерации). */
  editEnabled: boolean;
}

/** Пересказ сжатых сообщений активной ветки (для списка в настройках). */
export interface StoryCompaction {
  id: number;
  seq: number;
  summary: string;
  coveredCount: number;
  coveredTokens: number;
}

/** Почему сжатие недоступно: нет лимита контекста, лимит мал, компонент `compact` выключен в шаблоне. */
export type CompactUnavailableReason = "unlimited" | "too_small" | "template_off";

/** Статистика истории (токены) для экрана настроек — зеркало ChatStats без impersonate-вариантов. */
export interface StoryStats {
  tokensTotal: number;
  tokensActiveBranch: number;
  tokensPrompt: number;
  /** Лимит контекста из пресета; null — безграничный или не задан. */
  contextLimit: number | null;
  /** Доступно ли сжатие (есть лимит, достаточно большой, и компонент `compact` включён в шаблоне). */
  compactAvailable: boolean;
  /** Причина недоступности; null — доступно. */
  compactReason: CompactUnavailableReason | null;
  /** Включён ли компонент `compact` в шаблоне истории. */
  templateCompactEnabled: boolean;
}

/** Тело POST /api/stories. Книга, шаблон, пресет и стартовый бит обязательны. */
export interface CreateStoryRequest {
  bookId: number;
  templateId: number;
  presetId: number;
  openingBeat: string;
  premise: string;
}

/** Ответ сервера при создании истории (внутри `{ story }`). */
export interface StoryCreated {
  id: number;
}

/**
 * Тело PATCH /api/stories/:id. Webapp шлёт поля отдельными запросами; если пришли оба — применяется
 * только title. Ответ — `{ title }` либо `{ premise }`.
 */
export interface UpdateStoryRequest {
  title?: string;
  premise?: string;
}

/** Тело POST .../advance: непустая директива — режиссёрский ход, пусто/нет — «Дальше». */
export interface AdvanceStoryRequest {
  directive?: string;
}

/** Тело POST .../messages/:msgId/edit — правка текста бита на месте (без генерации). */
export interface EditStoryBeatRequest {
  content: string;
}

/** Ответ правки бита: новый текст и кэш переводов (сбрасывается — относился к старому тексту). */
export interface EditStoryBeatResponse {
  content: string;
  translations: Record<string, string> | null;
}

/** Ответ POST .../compact: сколько пересказов создано + обновлённый список активной ветки. */
export interface CompactStoryResponse {
  created: number;
  compactions: StoryCompaction[];
}
