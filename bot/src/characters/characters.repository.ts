import { Injectable } from "@nestjs/common";
import type { CharacterInput, CharacterListItem } from "@tg-rp-bot/shared";
import { and, desc, eq, sql } from "drizzle-orm";
import { schema } from "../db/index.js";
import type { Character } from "../db/schema.js";
import { DatabaseService } from "../database/database.service.js";
import logger from "../logger.js";
import { decryptField, encryptField } from "../utils/index.js";
import { UserKeysService } from "../user-keys/user-keys.service.js";

/**
 * Доступ к таблице characters. Все запросы ограничены владельцем (user_id); текстовые поля
 * шифруются per-user ключом (utils/crypto.ts) на записи и расшифровываются на чтении.
 */
@Injectable()
export class CharactersRepository {
  constructor(
    private readonly database: DatabaseService,
    private readonly keys: UserKeysService,
  ) {}

  /** Список персонажей пользователя (метаданные, без image) — свежие сверху. */
  async list(userId: string): Promise<CharacterListItem[]> {
    const t0 = Date.now();
    const rows = await this.database.db
      .select({
        id: schema.characters.id,
        name: schema.characters.name,
        tags: schema.characters.tags,
        footnote: schema.characters.footnote,
        // длина jsonb-массива первых сообщений считается на стороне БД — список не тянет тексты
        firstMessageCount: sql<number>`jsonb_array_length(${schema.characters.firstMessages})`,
        // только наличие аватара (не сами байты) — картинку список грузит отдельным запросом
        hasImage: sql<boolean>`${schema.characters.image} is not null`,
      })
      .from(schema.characters)
      .where(eq(schema.characters.userId, userId))
      .orderBy(desc(schema.characters.updatedAt));
    // список не проходит через decryptRow — расшифровываем теги и примечание здесь
    const key = await this.keys.forUser(userId);
    const result = rows.map((row) => ({
      ...row,
      tags: row.tags.map((tag) => decryptField(tag, key)),
      footnote: decryptField(row.footnote, key),
    }));
    logger.debug({ durationMs: Date.now() - t0, userId, count: result.length }, "Characters listed");
    return result;
  }

  /** Сколько персонажей у пользователя (для проверки мягкого лимита). */
  async count(userId: string): Promise<number> {
    const rows = await this.database.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.characters)
      .where(eq(schema.characters.userId, userId));
    return rows[0]?.count ?? 0;
  }

  /** Полный персонаж по id, только если он принадлежит этому пользователю. */
  async findOne(userId: string, id: number): Promise<Character | undefined> {
    const rows = await this.database.db
      .select()
      .from(schema.characters)
      .where(this.ownedBy(userId, id));
    const row = rows[0];
    return row ? this.decryptRow(row, await this.keys.forUser(userId)) : undefined;
  }

  /**
   * Только аватар (одна колонка, без промпта/сообщений). undefined — персонажа нет/не его;
   * null — есть, но без картинки; string — data URL.
   */
  async findImage(userId: string, id: number): Promise<string | null | undefined> {
    const rows = await this.database.db
      .select({ image: schema.characters.image })
      .from(schema.characters)
      .where(this.ownedBy(userId, id));
    return rows[0]?.image;
  }

  /**
   * Полноразмерное (некадрированное) фото — грузится только при открытии лайтбокса. Семантика
   * undefined/null/string — как у findImage; у старых персонажей null до следующего сохранения.
   */
  async findImageFull(userId: string, id: number): Promise<string | null | undefined> {
    const rows = await this.database.db
      .select({ imageFull: schema.characters.imageFull })
      .from(schema.characters)
      .where(this.ownedBy(userId, id));
    return rows[0]?.imageFull;
  }

  /** Создаёт персонажа и возвращает созданную строку. */
  async create(userId: string, input: CharacterInput): Promise<Character> {
    const t0 = Date.now();
    const rows = await this.database.db
      .insert(schema.characters)
      .values({ userId, ...this.encryptInput(await this.keys.forUser(userId), input) })
      .returning();
    const created = rows[0]!; // insert ... returning всегда отдаёт одну строку
    logger.info({ durationMs: Date.now() - t0, userId, id: created.id }, "Character created");
    return this.decryptRow(created, await this.keys.forUser(userId));
  }

  /** Обновляет персонажа (только своего); undefined — если такого у пользователя нет. */
  async update(userId: string, id: number, input: CharacterInput): Promise<Character | undefined> {
    const t0 = Date.now();
    const rows = await this.database.db
      .update(schema.characters)
      .set(this.encryptInput(await this.keys.forUser(userId), input))
      .where(this.ownedBy(userId, id))
      .returning();
    const updated = rows[0];
    logger.info(
      { durationMs: Date.now() - t0, userId, id, found: Boolean(updated) },
      "Character update attempted",
    );
    return updated ? this.decryptRow(updated, await this.keys.forUser(userId)) : undefined;
  }

  /** Удаляет персонажа (только своего). true — если строка была удалена. */
  async delete(userId: string, id: number): Promise<boolean> {
    const t0 = Date.now();
    const rows = await this.database.db
      .delete(schema.characters)
      .where(this.ownedBy(userId, id))
      .returning({ id: schema.characters.id });
    const deleted = rows.length > 0;
    logger.info({ durationMs: Date.now() - t0, userId, id, deleted }, "Character delete attempted");
    return deleted;
  }

  private ownedBy(userId: string, id: number) {
    return and(eq(schema.characters.id, id), eq(schema.characters.userId, userId));
  }

  /** Колонки для insert/update: текстовые поля зашифрованы, имя и картинки — как есть. */
  private encryptInput(key: Buffer, input: CharacterInput) {
    return {
      name: input.name,
      tags: input.tags.map((tag) => encryptField(tag, key)),
      footnote: encryptField(input.footnote, key),
      prompt: encryptField(input.prompt, key),
      scenario: encryptField(input.scenario, key),
      firstMessages: input.firstMessages.map((msg) => encryptField(msg, key)),
      image: input.image,
      imageFull: input.imageFull,
    };
  }

  private decryptRow(row: Character, key: Buffer): Character {
    return {
      ...row,
      tags: row.tags.map((tag) => decryptField(tag, key)),
      footnote: decryptField(row.footnote, key),
      prompt: decryptField(row.prompt, key),
      scenario: decryptField(row.scenario, key),
      firstMessages: row.firstMessages.map((msg) => decryptField(msg, key)),
    };
  }
}
