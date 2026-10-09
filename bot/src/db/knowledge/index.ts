import { DatabaseService } from "../../database/database.service.js";
import { BooksRepository } from "../../knowledge-books/books/books.repository.js";
import { EntriesPromptRepository } from "../../knowledge-books/entries/entries-prompt.repository.js";

/**
 * ВРЕМЕННЫЙ мост для legacy stories (книга истории и её записи для промпта): те же репозитории, что
 * в Nest (KnowledgeBooksModule). Удаляется, когда stories переедут на Nest.
 */
const database = new DatabaseService();
const books = new BooksRepository(database);
const entriesPrompt = new EntriesPromptRepository(database);

export type { PromptEntry } from "../../knowledge-books/entries/entries-prompt.repository.js";

/** Полная книга по id, только если принадлежит пользователю. */
export const getBook = (userId: number, id: number) => books.findOne(userId, id);

/** Включённые записи книги, готовые к подстановке в промпт. */
export const getActiveEntriesForPrompt = (userId: number, bookId: number) =>
  entriesPrompt.findActive(userId, bookId);
