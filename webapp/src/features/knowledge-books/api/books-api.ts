import { apiFetch } from "../../../shared/api/client";
import type { Book, BookInput, BookListItem, Entry, EntryInput } from "../types/book";

/** Обёртки над apiFetch для CRUD книг знаний и их записей. Граница webapp → /api/books. */

export function listBooks(): Promise<{ books: BookListItem[] }> {
  return apiFetch<{ books: BookListItem[] }>("/books");
}

export function getBook(id: number): Promise<{ book: Book }> {
  return apiFetch<{ book: Book }>(`/books/${id}`);
}

export function createBook(input: BookInput): Promise<{ book: Book }> {
  return apiFetch<{ book: Book }>("/books", { method: "POST", body: JSON.stringify(input) });
}

export function updateBook(id: number, input: BookInput): Promise<{ book: Book }> {
  return apiFetch<{ book: Book }>(`/books/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function removeBook(id: number): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/books/${id}`, { method: "DELETE" });
}

export function listEntries(bookId: number): Promise<{ entries: Entry[] }> {
  return apiFetch<{ entries: Entry[] }>(`/books/${bookId}/entries`);
}

export function createEntry(bookId: number, input: EntryInput): Promise<{ entry: { id: number } }> {
  return apiFetch<{ entry: { id: number } }>(`/books/${bookId}/entries`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateEntry(bookId: number, entryId: number, input: EntryInput): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/books/${bookId}/entries/${entryId}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function removeEntry(bookId: number, entryId: number): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/books/${bookId}/entries/${entryId}`, { method: "DELETE" });
}
