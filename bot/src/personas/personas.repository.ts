import { Injectable } from "@nestjs/common";
import type { PersonaInput, PersonaListItem } from "@tg-rp-bot/shared";
import { and, desc, eq, sql } from "drizzle-orm";
import { schema } from "../db/index.js";
import type { Persona } from "../db/schema.js";
import { DatabaseService } from "../database/database.service.js";
import logger from "../logger.js";
import { decryptField, encryptField, getUserEncryptionKey } from "../utils/index.js";

/**
 * Доступ к таблице personas. Все запросы ограничены владельцем (user_id); prompt и footnote
 * шифруются per-user ключом (utils/crypto.ts) на записи и расшифровываются на чтении.
 */
@Injectable()
export class PersonasRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Список персон пользователя (метаданные, без image) — свежие сверху. */
  async list(userId: number): Promise<PersonaListItem[]> {
    const t0 = Date.now();
    const rows = await this.database.db
      .select({
        id: schema.personas.id,
        name: schema.personas.name,
        footnote: schema.personas.footnote,
        // только наличие аватара (не сами байты) — картинку список грузит отдельным запросом
        hasImage: sql<boolean>`${schema.personas.image} is not null`,
      })
      .from(schema.personas)
      .where(eq(schema.personas.userId, userId))
      .orderBy(desc(schema.personas.updatedAt));
    // список не проходит через decryptRow — расшифровываем примечание здесь
    const key = getUserEncryptionKey(userId);
    const result = rows.map((row) => ({ ...row, footnote: decryptField(row.footnote, key) }));
    logger.debug({ durationMs: Date.now() - t0, userId, count: result.length }, "Personas listed");
    return result;
  }

  /** Сколько персон у пользователя (для проверки мягкого лимита). */
  async count(userId: number): Promise<number> {
    const rows = await this.database.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.personas)
      .where(eq(schema.personas.userId, userId));
    return rows[0]?.count ?? 0;
  }

  /** Полная персона по id, только если она принадлежит этому пользователю. */
  async findOne(userId: number, id: number): Promise<Persona | undefined> {
    const rows = await this.database.db.select().from(schema.personas).where(this.ownedBy(userId, id));
    const row = rows[0];
    return row ? this.decryptRow(row, userId) : undefined;
  }

  /** Только аватар. undefined — персоны нет/не его; null — есть, но без картинки; string — data URL. */
  async findImage(userId: number, id: number): Promise<string | null | undefined> {
    const rows = await this.database.db
      .select({ image: schema.personas.image })
      .from(schema.personas)
      .where(this.ownedBy(userId, id));
    return rows[0]?.image;
  }

  /**
   * Полноразмерное (некадрированное) фото — грузится только при открытии лайтбокса. Семантика
   * undefined/null/string — как у findImage; у старых персон null до следующего сохранения.
   */
  async findImageFull(userId: number, id: number): Promise<string | null | undefined> {
    const rows = await this.database.db
      .select({ imageFull: schema.personas.imageFull })
      .from(schema.personas)
      .where(this.ownedBy(userId, id));
    return rows[0]?.imageFull;
  }

  /** Создаёт персону и возвращает созданную строку. */
  async create(userId: number, input: PersonaInput): Promise<Persona> {
    const t0 = Date.now();
    const rows = await this.database.db
      .insert(schema.personas)
      .values({ userId, ...this.encryptInput(userId, input) })
      .returning();
    const created = rows[0]!; // insert ... returning всегда отдаёт одну строку
    logger.info({ durationMs: Date.now() - t0, userId, id: created.id }, "Persona created");
    return this.decryptRow(created, userId);
  }

  /** Обновляет персону (только свою); undefined — если такой у пользователя нет. */
  async update(userId: number, id: number, input: PersonaInput): Promise<Persona | undefined> {
    const t0 = Date.now();
    const rows = await this.database.db
      .update(schema.personas)
      .set(this.encryptInput(userId, input))
      .where(this.ownedBy(userId, id))
      .returning();
    const updated = rows[0];
    logger.info(
      { durationMs: Date.now() - t0, userId, id, found: Boolean(updated) },
      "Persona update attempted",
    );
    return updated ? this.decryptRow(updated, userId) : undefined;
  }

  /** Удаляет персону (только свою). true — если строка была удалена. */
  async delete(userId: number, id: number): Promise<boolean> {
    const t0 = Date.now();
    const rows = await this.database.db
      .delete(schema.personas)
      .where(this.ownedBy(userId, id))
      .returning({ id: schema.personas.id });
    const deleted = rows.length > 0;
    logger.info({ durationMs: Date.now() - t0, userId, id, deleted }, "Persona delete attempted");
    return deleted;
  }

  private ownedBy(userId: number, id: number) {
    return and(eq(schema.personas.id, id), eq(schema.personas.userId, userId));
  }

  /** Колонки для insert/update: prompt и footnote зашифрованы, имя и картинки — как есть. */
  private encryptInput(userId: number, input: PersonaInput) {
    const key = getUserEncryptionKey(userId);
    return {
      name: input.name,
      prompt: encryptField(input.prompt, key),
      footnote: encryptField(input.footnote, key),
      image: input.image,
      imageFull: input.imageFull,
    };
  }

  private decryptRow(row: Persona, userId: number): Persona {
    const key = getUserEncryptionKey(userId);
    return { ...row, prompt: decryptField(row.prompt, key), footnote: decryptField(row.footnote, key) };
  }
}
