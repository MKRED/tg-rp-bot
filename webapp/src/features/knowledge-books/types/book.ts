/** Типы фичи «книги знаний» (lorebook) для narrator-режима — контракт API из @tg-rp-bot/shared. */

export type {
  Book,
  BookInput,
  BookListItem,
  EntryActivation,
  EntryInput,
  EntryListItem as Entry,
} from "@tg-rp-bot/shared";
export {
  DEFAULT_KEYWORD_DEPTH,
  MAX_BOOKS_PER_USER,
  MAX_ENTRIES_PER_BOOK,
  MAX_KEYWORD_DEPTH,
  MIN_KEYWORD_DEPTH,
} from "@tg-rp-bot/shared";
