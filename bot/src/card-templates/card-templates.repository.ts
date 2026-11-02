import { Injectable } from "@nestjs/common";
import type { CardTemplateInput } from "@tg-rp-bot/shared";
import { and, desc, eq, sql } from "drizzle-orm";
import { decryptFields, encryptFields } from "../cards/card-crypto.js";
import { DatabaseService } from "../database/database.service.js";
import { schema } from "../db/index.js";
import type { CardTemplateRow } from "../db/schema.js";
import logger from "../logger.js";
import { UserKeysService } from "../user-keys/user-keys.service.js";
import { decryptField, encryptField } from "../utils/index.js";

/**
 * Доступ к таблице card_templates. Все запросы ограничены владельцем (user_id); systemPrompt и
 * title/description полей шифруются per-user ключом на записи и расшифровываются на чтении.
 */
@Injectable()
export class CardTemplatesRepository {
  constructor(
    private readonly database: DatabaseService,
    private readonly keys: UserKeysService,
  ) {}

  /** Шаблоны пользователя целиком (расшифрованы) — свежие сверху. */
  async list(userId: string): Promise<CardTemplateRow[]> {
    const t0 = Date.now();
    const rows = await this.database.db
      .select()
      .from(schema.cardTemplates)
      .where(eq(schema.cardTemplates.userId, userId))
      .orderBy(desc(schema.cardTemplates.updatedAt));
    const key = await this.keys.forUser(userId);
    logger.debug({ durationMs: Date.now() - t0, userId, count: rows.length }, "Card templates listed");
    return rows.map((row) => decryptRow(row, key));
  }

  /** Сколько шаблонов у пользователя (для проверки мягкого лимита). */
  async count(userId: string): Promise<number> {
    const t0 = Date.now();
    const rows = await this.database.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.cardTemplates)
      .where(eq(schema.cardTemplates.userId, userId));
    const count = rows[0]?.count ?? 0;
    logger.debug({ durationMs: Date.now() - t0, userId, count }, "Card templates counted");
    return count;
  }

  /** Шаблон по id, только если он принадлежит этому пользователю (расшифрован). */
  async findOne(userId: string, id: number): Promise<CardTemplateRow | undefined> {
    const rows = await this.database.db.select().from(schema.cardTemplates).where(this.ownedBy(userId, id));
    const row = rows[0];
    return row ? decryptRow(row, await this.keys.forUser(userId)) : undefined;
  }

  async create(userId: string, input: CardTemplateInput): Promise<CardTemplateRow> {
    const t0 = Date.now();
    const key = await this.keys.forUser(userId);
    const rows = await this.database.db
      .insert(schema.cardTemplates)
      .values({ userId, ...encryptInput(input, key) })
      .returning();
    const created = rows[0]!; // insert ... returning всегда отдаёт одну строку
    logger.info(
      { durationMs: Date.now() - t0, userId, id: created.id, fields: input.fields.length },
      "Card template created",
    );
    return decryptRow(created, key);
  }

  /** Обновляет шаблон (только свой); undefined — если такого у пользователя нет. */
  async update(userId: string, id: number, input: CardTemplateInput): Promise<CardTemplateRow | undefined> {
    const t0 = Date.now();
    const key = await this.keys.forUser(userId);
    const rows = await this.database.db
      .update(schema.cardTemplates)
      .set(encryptInput(input, key))
      .where(this.ownedBy(userId, id))
      .returning();
    const updated = rows[0];
    logger.info({ durationMs: Date.now() - t0, userId, id, found: Boolean(updated) }, "Card template update attempted");
    return updated ? decryptRow(updated, key) : undefined;
  }

  /** Удаляет шаблон (только свой). true — строка была удалена. */
  async delete(userId: string, id: number): Promise<boolean> {
    const t0 = Date.now();
    const rows = await this.database.db
      .delete(schema.cardTemplates)
      .where(this.ownedBy(userId, id))
      .returning({ id: schema.cardTemplates.id });
    const deleted = rows.length > 0;
    logger.info({ durationMs: Date.now() - t0, userId, id, deleted }, "Card template delete attempted");
    return deleted;
  }

  private ownedBy(userId: string, id: number) {
    return and(eq(schema.cardTemplates.id, id), eq(schema.cardTemplates.userId, userId));
  }
}

function encryptInput(input: CardTemplateInput, key: Buffer): CardTemplateInput {
  return { ...input, systemPrompt: encryptField(input.systemPrompt, key), fields: encryptFields(input.fields, key) };
}

function decryptRow(row: CardTemplateRow, key: Buffer): CardTemplateRow {
  return { ...row, systemPrompt: decryptField(row.systemPrompt, key), fields: decryptFields(row.fields, key) };
}
