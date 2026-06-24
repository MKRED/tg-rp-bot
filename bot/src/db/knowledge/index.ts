// Баррел домена книг знаний (lorebook): публичная поверхность для server/*.

export type { BookInput, BookListItem, EntryInput, EntryListItem, PromptEntry } from "./types.js";

export { listBooks, getBook, countBooks, createBook, updateBook, deleteBook } from "./books.js";

export {
  listEntries,
  countEntries,
  createEntry,
  updateEntry,
  deleteEntry,
  getActiveEntriesForPrompt,
} from "./entries.js";
