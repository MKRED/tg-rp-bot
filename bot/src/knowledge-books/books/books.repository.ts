import { Injectable } from "@nestjs/common";
import type { BookInput, BookListItem } from "@tg-rp-bot/shared";
import { and, eq, sql } from "drizzle-orm";
import { DatabaseService } from "../../database/database.service.js";
import { schema } from "../../db/index.js";
import type { KnowledgeBook } from "../../db/schema.js";
import logger from "../../logger.js";

/**
 * Книги знаний (knowledge_books) пользователя: список со счётчиком записей и CRUD; владение — по user_id.
 */
@Injectable()
export class BooksRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Список книг знаний пользователя (свежие сверху) + счётчик записей в каждой. */
  async list(userId: number): Promise<BookListItem[]> {
    const t0 = Date.now();
    const rows = await this.database.db.execute(sql`
      SELECT
        b.id, b.name, b.description, b.created_at,
        COALESCE(ec.cnt, 0) AS entry_count
      FROM knowledge_books b
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt FROM knowledge_book_entries WHERE book_id = b.id
      ) ec ON TRUE
      WHERE b.user_id = ${userId}
      ORDER BY b.created_at DESC
    `);
    logger.debug({ durationMs: Date.now() - t0, userId, count: (rows as unknown[]).length }, "Books listed");
    return (rows as Record<string, unknown>[]).map((r) => ({
      // bigint из сырого SQL postgres.js отдаёт строкой — приводим к number явно
      // (каст `as number` лгал: id уходил в JSON строкой и ломал typeof-проверку при создании истории).
      id: Number(r.id),
      name: r.name as string,
      description: (r.description as string | null) ?? null,
      entryCount: r.entry_count as number,
      createdAt: String(r.created_at),
    }));
  }

  /** Полная книга по id, только если принадлежит пользователю. */
  async findOne(userId: number, id: number): Promise<KnowledgeBook | undefined> {
    const rows = await this.database.db
      .select()
      .from(schema.knowledgeBooks)
      .where(and(eq(schema.knowledgeBooks.id, id), eq(schema.knowledgeBooks.userId, userId)));
    return rows[0];
  }

  /** Сколько книг у пользователя (для мягкого лимита). */
  async count(userId: number): Promise<number> {
    const rows = await this.database.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.knowledgeBooks)
      .where(eq(schema.knowledgeBooks.userId, userId));
    return rows[0]?.count ?? 0;
  }

  /** Создаёт книгу и возвращает созданную строку. */
  async create(userId: number, input: BookInput): Promise<KnowledgeBook> {
    const t0 = Date.now();
    const rows = await this.database.db
      .insert(schema.knowledgeBooks)
      .values({ userId, name: input.name, description: input.description })
      .returning();
    const created = rows[0]!;
    logger.info({ durationMs: Date.now() - t0, userId, id: created.id }, "Book created");
    return created;
  }

  /** Обновляет книгу (только свою). undefined — если не найдена. */
  async update(
    userId: number,
    id: number,
    input: BookInput,
  ): Promise<KnowledgeBook | undefined> {
    const t0 = Date.now();
    const rows = await this.database.db
      .update(schema.knowledgeBooks)
      .set({ name: input.name, description: input.description })
      .where(and(eq(schema.knowledgeBooks.id, id), eq(schema.knowledgeBooks.userId, userId)))
      .returning();
    const updated = rows[0];
    logger.info({ durationMs: Date.now() - t0, userId, id, found: Boolean(updated) }, "Book update attempted");
    return updated;
  }

  /** Удаляет книгу (только свою). true — если строка была удалена. */
  async remove(userId: number, id: number): Promise<boolean> {
    const t0 = Date.now();
    const rows = await this.database.db
      .delete(schema.knowledgeBooks)
      .where(and(eq(schema.knowledgeBooks.id, id), eq(schema.knowledgeBooks.userId, userId)))
      .returning({ id: schema.knowledgeBooks.id });
    const deleted = rows.length > 0;
    logger.info({ durationMs: Date.now() - t0, userId, id, deleted }, "Book delete attempted");
    return deleted;
  }
}
