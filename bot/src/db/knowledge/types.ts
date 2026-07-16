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

/**
 * Поля записи книги из формы. Запись — ровно один из трёх видов: ссылка на персонажа (characterId),
 * ссылка на персону (personaId) или свободный текст (content).
 */
export type EntryInput = {
  name: string;
  enabled: boolean;
  activation: "always_on" | "keyword";
  characterId: number | null;
  personaId: number | null;
  // Значение для недостающей стороны: {{user}} у записи-персонажа, {{char}} у записи-персоны
  // (обязательно, если промпт соответствующей сущности содержит плейсхолдер).
  alias: string;
  content: string;
  keywords: string[];
};

/** Запись книги для UI: + резолв персонажа/персоны (имя/наличие картинки), если это ссылочная запись. */
export type EntryListItem = {
  id: number;
  name: string;
  enabled: boolean;
  activation: "always_on" | "keyword";
  characterId: number | null;
  characterName: string | null;
  characterHasImage: boolean;
  personaId: number | null;
  personaName: string | null;
  personaHasImage: boolean;
  alias: string;
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
