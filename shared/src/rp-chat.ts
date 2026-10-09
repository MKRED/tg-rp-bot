import type { PromptTranslateEngine } from "./settings.js";

/** Размер страницы списка чатов по умолчанию и потолок (сервер приводит pageSize к 1..MAX). */
export const DEFAULT_CHATS_PAGE_SIZE = 20;
export const MAX_CHATS_PAGE_SIZE = 50;

/** Сервер обрезает название чата до этой длины (не 400), чтобы не раздувать список и шапку. */
export const MAX_CHAT_TITLE_LENGTH = 100;

/** Максимум сохранённых вариантов impersonate на один момент диалога — далее FIFO-вытеснение старого. */
export const MAX_IMPERSONATION_VARIANTS = 20;

export type MessageRole = "user" | "assistant";

/** На каких сообщениях показывать кнопку перевода (Globe). Общие с настройками истории narrator. */
export const TRANSLATE_SCOPES = ["all", "assistant", "user"] as const;
export type TranslateScope = (typeof TRANSLATE_SCOPES)[number];

/** Что переводить сразу при появлении сообщения; "none" — автоперевод выключен. */
export const AUTO_TRANSLATE_SCOPES = ["none", "all", "assistant", "user"] as const;
export type AutoTranslateScope = (typeof AUTO_TRANSLATE_SCOPES)[number];

export interface ChatListItem {
  id: number;
  title: string | null;
  character: { id: number; name: string; hasImage: boolean };
  persona: { id: number; name: string } | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  messageCount: number;
  createdAt: string;
}

/** Ответ GET /api/chats. */
export interface ChatListResponse {
  items: ChatListItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** Тело POST /api/chats. Персона, RP-шаблон и пресет обязательны (NOT NULL в схеме). */
export interface CreateChatRequest {
  characterId: number;
  personaId: number;
  templateId: number;
  presetId: number;
  /** Индекс приветствия из character.firstMessages; вне диапазона → чат без стартового сообщения. */
  firstMessageIndex: number;
}

/** Ответ сервера при создании чата (внутри `{ chat }`). */
export interface ChatCreated {
  id: number;
}

/** Тело PATCH /api/chats/:id. Пустая строка очищает название (UI вернётся к имени персонажа). */
export interface RenameChatRequest {
  title: string;
}

/**
 * Одно сообщение активного пути с информацией о сиблингах.
 * siblings — упорядоченные (created_at ASC) ID сиблингов для стрелок ← → в UI.
 */
export interface MessageInPath {
  id: number;
  parentId: number | null;
  role: MessageRole;
  content: string;
  translations: Record<string, string> | null;
  createdAt: string;
  siblingIndex: number;
  siblingCount: number;
  siblings: number[];
}

export interface ChatDetail {
  id: number;
  title: string | null;
  character: { id: number; name: string; hasImage: boolean };
  persona: { id: number; name: string; hasImage: boolean } | null;
  template: { id: number; name: string } | null;
  preset: { id: number; name: string } | null;
  activeMessageId: number | null;
  messages: MessageInPath[];
}

/** Узел дерева сообщений для графа веток (React Flow). */
export interface TreeNode {
  id: number;
  parentId: number | null;
  role: MessageRole;
  content: string;
  isOnActivePath: boolean;
  createdAt: string;
}

export interface ChatSettings {
  translateEnabled: boolean;
  translateTargetLang: string;
  translateScope: TranslateScope;
  autoTranslateScope: AutoTranslateScope;
  /** Метод перевода закэшированных сообщений (кнопка Globe): Google Translate либо ИИ. */
  translateMethod: PromptTranslateEngine;
}

/**
 * Статистика чата для экрана настроек. Числа считает СЕРВЕР точным BPE-токенайзером (o200k_base).
 * tokensTotal/tokensActiveBranch — только сообщения; tokensPrompt — полный запрос к LLM по активной
 * ветке (с системными/персонажными промптами, как при генерации).
 */
export interface ChatStats {
  tokensTotal: number;
  tokensActiveBranch: number;
  tokensPrompt: number;
  /** Лимит контекста из пресета; null — безграничный или не задан. */
  contextLimit: number | null;
  impersonationCount: number;
}

/** Тело POST .../messages (отправка) и .../messages/:msgId/edit. */
export interface SendMessageRequest {
  content: string;
}

/**
 * Тело POST .../messages/:msgId/translate. Метод (google/ai) берётся из настроек чата.
 * force=true пропускает кэш и пересчитывает перевод, перезаписывая его.
 */
export interface TranslateMessageRequest {
  targetLang: string;
  force?: boolean;
}

/**
 * Тело POST /api/chats/:id/translate-text — эфемерный перевод произвольного текста (черновик,
 * варианты impersonate). Без mode — Google Translate.
 */
export interface ChatTranslateTextRequest {
  text: string;
  targetLang: string;
  mode?: PromptTranslateEngine;
}

/** Ответ обоих переводов. */
export interface TranslationResponse {
  translation: string;
}

/** Сгенерированный вариант реплики «от лица пользователя» (impersonate). */
export interface ImpersonationVariant {
  id: number;
  content: string;
  createdAt: string;
}
