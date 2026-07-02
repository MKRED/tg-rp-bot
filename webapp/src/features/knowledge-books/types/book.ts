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

/** Запись книги (с резолвом персонажа, если это запись-персонаж). */
export type Entry = {
  id: number;
  name: string;
  enabled: boolean;
  activation: EntryActivation;
  characterId: number | null;
  characterName: string | null;
  characterHasImage: boolean;
  userAlias: string;
  content: string;
  keywords: string[];
  sortOrder: number;
};

export type EntryInput = {
  name: string;
  enabled: boolean;
  activation: EntryActivation;
  characterId: number | null;
  userAlias: string;
  content: string;
  keywords: string[];
  sortOrder: number;
};

export const MAX_BOOKS_PER_USER = 50;
export const MAX_ENTRIES_PER_BOOK = 200;
