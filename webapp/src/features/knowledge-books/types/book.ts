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
  MAX_BOOK_DESCRIPTION_LENGTH,
  MAX_BOOK_NAME_LENGTH,
  MAX_BOOKS_PER_USER,
  MAX_ENTRY_FIELD_LENGTH,
  MAX_ENTRIES_PER_BOOK,
  MAX_KEYWORD_DEPTH,
  MIN_KEYWORD_DEPTH,
} from "@tg-rp-bot/shared";
