import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { type BookInput, type BookListItem, MAX_BOOKS_PER_USER } from "@tg-rp-bot/shared";
import { found } from "../../common/found.js";
import { isFkViolation } from "../../common/fk-violation.js";
import type { KnowledgeBook } from "../../db/schema.js";
import { BooksRepository } from "./books.repository.js";

/** Книги знаний пользователя: мягкий лимит на число книг; удаление книги, занятой историей, — 409. */
@Injectable()
export class BooksService {
  constructor(private readonly books: BooksRepository) {}

  list(userId: string): Promise<BookListItem[]> {
    return this.books.list(userId);
  }

  async get(userId: string, id: number): Promise<KnowledgeBook> {
    return found(await this.books.findOne(userId, id));
  }

  async create(userId: string, input: BookInput): Promise<KnowledgeBook> {
    if ((await this.books.count(userId)) >= MAX_BOOKS_PER_USER) {
      throw new BadRequestException(`Book limit reached (max ${MAX_BOOKS_PER_USER})`);
    }
    return this.books.create(userId, input);
  }

  async update(userId: string, id: number, input: BookInput): Promise<KnowledgeBook> {
    return found(await this.books.update(userId, id, input));
  }

  async remove(userId: string, id: number): Promise<void> {
    let deleted: boolean;
    try {
      deleted = await this.books.remove(userId, id);
    } catch (err) {
      // FK (23503): книга привязана к истории — 409 in_use, webapp показывает понятный текст.
      if (isFkViolation(err)) throw new ConflictException("in_use");
      throw err;
    }
    if (!deleted) found(undefined);
  }
}
