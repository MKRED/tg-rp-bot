// Контракт книг знаний (lorebook) narrator-режима: /api/books и записи книги.

export const MAX_BOOKS_PER_USER = 50;
export const MAX_ENTRIES_PER_BOOK = 200;

/** Глубина поиска триггеров для activation="keyword" — сколько последних сообщений сканировать. */
export const DEFAULT_KEYWORD_DEPTH = 10;
export const MIN_KEYWORD_DEPTH = 1;
export const MAX_KEYWORD_DEPTH = 200;

/** Потолки длины полей (сервер обрезает, а не отклоняет). */
export const MAX_BOOK_NAME_LENGTH = 100;
export const MAX_BOOK_DESCRIPTION_LENGTH = 2000;
/** Имя записи, alias и каждое триггер-слово. */
export const MAX_ENTRY_FIELD_LENGTH = 100;

export const ENTRY_ACTIVATIONS = ["always_on", "keyword"] as const;
export type EntryActivation = (typeof ENTRY_ACTIVATIONS)[number];

/** Поля книги из формы Mini App (без серверных id/timestamps). */
export interface BookInput {
  name: string;
  description: string | null;
}

/** Книга в ответах GET/POST/PUT (сервер отдаёт строку целиком — webapp читает эти поля). */
export interface Book {
  id: number;
  name: string;
  description: string | null;
}

/** Лёгкая строка списка книг: id, имя, краткая сводка (описание + число записей). */
export interface BookListItem {
  id: number;
  name: string;
  description: string | null;
  entryCount: number;
  createdAt: string;
}

/**
 * Поля записи книги из формы. Запись — ровно один из трёх видов: ссылка на персонажа (characterId),
 * ссылка на персону (personaId) или свободный текст (content).
 */
export interface EntryInput {
  name: string;
  enabled: boolean;
  activation: EntryActivation;
  characterId: number | null;
  personaId: number | null;
  /**
   * Значение для недостающей стороны: {{user}} у записи-персонажа, {{char}} у записи-персоны
   * (обязательно, если промпт соответствующей сущности содержит плейсхолдер).
   */
  alias: string;
  content: string;
  keywords: string[];
  /** Глубина поиска триггеров (последние N сообщений истории) — значима только при activation="keyword". */
  keywordDepth: number;
}

/** Запись книги для UI: + резолв персонажа/персоны (имя/наличие картинки), если это ссылочная запись. */
export interface EntryListItem extends EntryInput {
  id: number;
  characterName: string | null;
  characterHasImage: boolean;
  personaName: string | null;
  personaHasImage: boolean;
  sortOrder: number;
}

/** Тело PUT /api/books/:id/entries/reorder — id записей в новом порядке (полная перестановка). */
export interface ReorderEntriesRequest {
  order: number[];
}
