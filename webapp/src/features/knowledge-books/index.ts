/** Публичная поверхность фичи «книги знаний» — то, что потребляют страницы. */

export { useBooks } from "./hooks/useBooks";
export { useBookEditor } from "./hooks/useBookEditor";
export { BookForm } from "./components/BookForm";
export { BookCard } from "./components/BookCard";
export { EntryEditor } from "./components/EntryEditor";
export {
  listBooks,
  getBook,
  createBook,
  updateBook,
  removeBook,
  listEntries,
  createEntry,
  updateEntry,
  removeEntry,
} from "./api/books-api";
export type {
  Book,
  BookInput,
  BookListItem,
  Entry,
  EntryInput,
  EntryActivation,
} from "./types/book";
export { MAX_BOOKS_PER_USER, MAX_ENTRIES_PER_BOOK } from "./types/book";
