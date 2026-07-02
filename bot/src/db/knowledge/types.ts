// Публичные типы домена книг знаний (lorebook) для narrator-режима.

/** Поля книги из формы Mini App (без серверных id/timestamps). */
export type BookInput = {
  name: string;
  description: string | null;
};

/** Лёгкая строка списка книг: id, имя, краткая сводка (описание + число записей). */
export type BookListItem = {
  id: number;
  name: string;
  description: string | null;
  entryCount: number;
  createdAt: string;
};

/** Поля записи книги из формы. Запись — либо ссылка на персонажа (characterId), либо свободный текст. */
export type EntryInput = {
  name: string;
  enabled: boolean;
  activation: "always_on" | "keyword";
  characterId: number | null;
  // Значение для {{user}} в промпте персонажа записи (обязательно, если промпт/сценарий его содержит).
  userAlias: string;
  content: string;
  keywords: string[];
  sortOrder: number;
};

/** Запись книги для UI: + резолв персонажа (имя/наличие картинки), если это запись-персонаж. */
export type EntryListItem = {
  id: number;
  name: string;
  enabled: boolean;
  activation: "always_on" | "keyword";
  characterId: number | null;
  characterName: string | null;
  characterHasImage: boolean;
  userAlias: string;
  content: string;
  keywords: string[];
  sortOrder: number;
};

/**
 * Запись, готовая к подстановке в промпт. Для записи-персонажа text собирается из карточки
 * (имя + описание + сценарий); для свободной — из content. activation решает, включать ли always_on.
 */
export type PromptEntry = {
  activation: "always_on" | "keyword";
  keywords: string[];
  /** Готовый текст для системного блока (имя записи в LLM НЕ уходит). */
  text: string;
};
