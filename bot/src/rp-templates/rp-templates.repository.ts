import { Injectable } from "@nestjs/common";
import type { RpTemplateInput } from "@tg-rp-bot/shared";
import { and, desc, eq, sql } from "drizzle-orm";
import { schema } from "../db/index.js";
import type { RpTemplate } from "../db/schema.js";
import { DatabaseService } from "../database/database.service.js";
import logger from "../logger.js";

/** Строка для списка: тексты и promptOrder нужны только сервису для подсчёта токенов. */
export type RpTemplateListRow = Pick<
  RpTemplate,
  "id" | "name" | "updatedAt" | "systemPrompt" | "auxiliarySystemPrompt" | "postHistoryInstruction" | "promptOrder"
>;

/**
 * Доступ к таблице rp_templates. Все запросы ограничены владельцем (user_id). Не шифруется —
 * как и раньше: тексты шаблона хранятся в открытом виде.
 */
@Injectable()
export class RpTemplatesRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Список шаблонов пользователя — свежие сверху. */
  async list(userId: number): Promise<RpTemplateListRow[]> {
    const t0 = Date.now();
    const rows = await this.database.db
      .select({
        id: schema.rpTemplates.id,
        name: schema.rpTemplates.name,
        updatedAt: schema.rpTemplates.updatedAt,
        systemPrompt: schema.rpTemplates.systemPrompt,
        auxiliarySystemPrompt: schema.rpTemplates.auxiliarySystemPrompt,
        postHistoryInstruction: schema.rpTemplates.postHistoryInstruction,
        promptOrder: schema.rpTemplates.promptOrder,
      })
      .from(schema.rpTemplates)
      .where(eq(schema.rpTemplates.userId, userId))
      .orderBy(desc(schema.rpTemplates.updatedAt));
    logger.debug({ durationMs: Date.now() - t0, userId, count: rows.length }, "RP templates listed");
    return rows;
  }

  /** Сколько шаблонов у пользователя (для проверки мягкого лимита). */
  async count(userId: number): Promise<number> {
    const rows = await this.database.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.rpTemplates)
      .where(eq(schema.rpTemplates.userId, userId));
    return rows[0]?.count ?? 0;
  }

  /** Полный шаблон по id, только если он принадлежит этому пользователю. */
  async findOne(userId: number, id: number): Promise<RpTemplate | undefined> {
    const rows = await this.database.db.select().from(schema.rpTemplates).where(this.ownedBy(userId, id));
    return rows[0];
  }

  /** Создаёт шаблон и возвращает созданную строку. */
  async create(userId: number, input: RpTemplateInput): Promise<RpTemplate> {
    const t0 = Date.now();
    const rows = await this.database.db
      .insert(schema.rpTemplates)
      .values({ userId, ...input })
      .returning();
    const created = rows[0]!; // insert ... returning всегда отдаёт одну строку
    logger.info({ durationMs: Date.now() - t0, userId, id: created.id }, "RP template created");
    return created;
  }

  /** Обновляет шаблон (только свой); undefined — если такого у пользователя нет. */
  async update(userId: number, id: number, input: RpTemplateInput): Promise<RpTemplate | undefined> {
    const t0 = Date.now();
    const rows = await this.database.db
      .update(schema.rpTemplates)
      .set(input)
      .where(this.ownedBy(userId, id))
      .returning();
    const updated = rows[0];
    logger.info(
      { durationMs: Date.now() - t0, userId, id, found: Boolean(updated) },
      "RP template update attempted",
    );
    return updated;
  }

  /** Удаляет шаблон (только свой). true — если строка была удалена. */
  async delete(userId: number, id: number): Promise<boolean> {
    const t0 = Date.now();
    const rows = await this.database.db
      .delete(schema.rpTemplates)
      .where(this.ownedBy(userId, id))
      .returning({ id: schema.rpTemplates.id });
    const deleted = rows.length > 0;
    logger.info({ durationMs: Date.now() - t0, userId, id, deleted }, "RP template delete attempted");
    return deleted;
  }

  private ownedBy(userId: number, id: number) {
    return and(eq(schema.rpTemplates.id, id), eq(schema.rpTemplates.userId, userId));
  }
}
