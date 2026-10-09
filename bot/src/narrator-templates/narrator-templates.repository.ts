import { Injectable } from "@nestjs/common";
import type { NarratorTemplateInput } from "@tg-rp-bot/shared";
import { and, desc, eq, sql } from "drizzle-orm";
import { schema } from "../db/index.js";
import type { NarratorTemplate } from "../db/schema.js";
import { DatabaseService } from "../database/database.service.js";
import logger from "../logger.js";

/** Строка для списка: тексты и promptOrder нужны только сервису для подсчёта токенов. */
export type NarratorTemplateListRow = Pick<
  NarratorTemplate,
  "id" | "name" | "updatedAt" | "systemPrompt" | "auxiliarySystemPrompt" | "postHistoryInstruction" | "promptOrder"
>;

/**
 * Доступ к таблице narrator_templates. Все запросы ограничены владельцем (user_id). Не шифруется —
 * как и раньше: тексты шаблона хранятся в открытом виде.
 */
@Injectable()
export class NarratorTemplatesRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Список шаблонов пользователя — свежие сверху. */
  async list(userId: number): Promise<NarratorTemplateListRow[]> {
    const t0 = Date.now();
    const rows = await this.database.db
      .select({
        id: schema.narratorTemplates.id,
        name: schema.narratorTemplates.name,
        updatedAt: schema.narratorTemplates.updatedAt,
        systemPrompt: schema.narratorTemplates.systemPrompt,
        auxiliarySystemPrompt: schema.narratorTemplates.auxiliarySystemPrompt,
        postHistoryInstruction: schema.narratorTemplates.postHistoryInstruction,
        promptOrder: schema.narratorTemplates.promptOrder,
      })
      .from(schema.narratorTemplates)
      .where(eq(schema.narratorTemplates.userId, userId))
      .orderBy(desc(schema.narratorTemplates.updatedAt));
    logger.debug({ durationMs: Date.now() - t0, userId, count: rows.length }, "Narrator templates listed");
    return rows;
  }

  /** Сколько шаблонов у пользователя (для проверки мягкого лимита). */
  async count(userId: number): Promise<number> {
    const rows = await this.database.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.narratorTemplates)
      .where(eq(schema.narratorTemplates.userId, userId));
    return rows[0]?.count ?? 0;
  }

  /** Полный шаблон по id, только если он принадлежит этому пользователю. */
  async findOne(userId: number, id: number): Promise<NarratorTemplate | undefined> {
    const rows = await this.database.db.select().from(schema.narratorTemplates).where(this.ownedBy(userId, id));
    return rows[0];
  }

  /** Создаёт шаблон и возвращает созданную строку. */
  async create(userId: number, input: NarratorTemplateInput): Promise<NarratorTemplate> {
    const t0 = Date.now();
    const rows = await this.database.db
      .insert(schema.narratorTemplates)
      .values({ userId, ...input })
      .returning();
    const created = rows[0]!; // insert ... returning всегда отдаёт одну строку
    logger.info({ durationMs: Date.now() - t0, userId, id: created.id }, "Narrator template created");
    return created;
  }

  /** Обновляет шаблон (только свой); undefined — если такого у пользователя нет. */
  async update(userId: number, id: number, input: NarratorTemplateInput): Promise<NarratorTemplate | undefined> {
    const t0 = Date.now();
    const rows = await this.database.db
      .update(schema.narratorTemplates)
      .set(input)
      .where(this.ownedBy(userId, id))
      .returning();
    const updated = rows[0];
    logger.info(
      { durationMs: Date.now() - t0, userId, id, found: Boolean(updated) },
      "Narrator template update attempted",
    );
    return updated;
  }

  /** Удаляет шаблон (только свой). true — если строка была удалена. */
  async delete(userId: number, id: number): Promise<boolean> {
    const t0 = Date.now();
    const rows = await this.database.db
      .delete(schema.narratorTemplates)
      .where(this.ownedBy(userId, id))
      .returning({ id: schema.narratorTemplates.id });
    const deleted = rows.length > 0;
    logger.info({ durationMs: Date.now() - t0, userId, id, deleted }, "Narrator template delete attempted");
    return deleted;
  }

  private ownedBy(userId: number, id: number) {
    return and(eq(schema.narratorTemplates.id, id), eq(schema.narratorTemplates.userId, userId));
  }
}
