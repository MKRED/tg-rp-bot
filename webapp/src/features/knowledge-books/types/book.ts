/** Типы фичи «книги знаний» (lorebook) для narrator-режима. */

export type BookListItem = {
  id: number;
  name: string;
  description: string | null;
  entryCount: number;
  createdAt: string;
};

export type Book = {
  id: number;
  name: string;
  description: string | null;
};

export type BookInput = {
  name: string;
  description: string | null;
};

export type EntryActivation = "always_on" | "keyword";

/** Запись книги (с резолвом персонажа/персоны, если это ссылочная запись). */
export type Entry = {
  id: number;
  name: string;
  enabled: boolean;
  activation: EntryActivation;
  characterId: number | null;
  characterName: string | null;
  characterHasImage: boolean;
  personaId: number | null;
  personaName: string | null;
  personaHasImage: boolean;
  alias: string;
  content: string;
  keywords: string[];
  keywordDepth: number;
  sortOrder: number;
};

export type EntryInput = {
  name: string;
  enabled: boolean;
  activation: EntryActivation;
  characterId: number | null;
  personaId: number | null;
  alias: string;
  content: string;
  keywords: string[];
  keywordDepth: number;
};

export const MAX_BOOKS_PER_USER = 50;
export const MAX_ENTRIES_PER_BOOK = 200;

/** Глубина поиска триггеров для activation="keyword" — сколько последних сообщений сканировать. */
export const DEFAULT_KEYWORD_DEPTH = 10;
export const MIN_KEYWORD_DEPTH = 1;
export const MAX_KEYWORD_DEPTH = 200;
