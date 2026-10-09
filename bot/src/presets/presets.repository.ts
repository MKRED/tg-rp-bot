import { Injectable } from "@nestjs/common";
import type { PresetInput, PresetListItem } from "@tg-rp-bot/shared";
import { and, desc, eq, sql } from "drizzle-orm";
import { schema } from "../db/index.js";
import type { GenerationPreset } from "../db/schema.js";
import { DatabaseService } from "../database/database.service.js";
import logger from "../logger.js";

/**
 * Доступ к таблице generation_presets. Все запросы ограничены владельцем (user_id). Пресет —
 * только числа и флаги, без пользовательских текстов, поэтому не шифруется (в отличие от персон).
 */
@Injectable()
export class PresetsRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Список пресетов пользователя (поля для сводки в списке) — свежие сверху. */
  async list(userId: number): Promise<PresetListItem[]> {
    const t0 = Date.now();
    const rows = await this.database.db
      .select({
        id: schema.generationPresets.id,
        name: schema.generationPresets.name,
        temperature: schema.generationPresets.temperature,
        contextUnlimited: schema.generationPresets.contextUnlimited,
        contextSize: schema.generationPresets.contextSize,
        maxTokens: schema.generationPresets.maxTokens,
        streaming: schema.generationPresets.streaming,
        requestReasoning: schema.generationPresets.requestReasoning,
        reasoningEffort: schema.generationPresets.reasoningEffort,
      })
      .from(schema.generationPresets)
      .where(eq(schema.generationPresets.userId, userId))
      .orderBy(desc(schema.generationPresets.updatedAt));
    logger.debug({ durationMs: Date.now() - t0, userId, count: rows.length }, "Presets listed");
    return rows;
  }

  /** Сколько пресетов у пользователя (для проверки мягкого лимита). */
  async count(userId: number): Promise<number> {
    const rows = await this.database.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.generationPresets)
      .where(eq(schema.generationPresets.userId, userId));
    return rows[0]?.count ?? 0;
  }

  /** Полный пресет по id, только если он принадлежит этому пользователю. */
  async findOne(userId: number, id: number): Promise<GenerationPreset | undefined> {
    const rows = await this.database.db
      .select()
      .from(schema.generationPresets)
      .where(this.ownedBy(userId, id));
    return rows[0];
  }

  /** Создаёт пресет и возвращает созданную строку. */
  async create(userId: number, input: PresetInput): Promise<GenerationPreset> {
    const t0 = Date.now();
    const rows = await this.database.db
      .insert(schema.generationPresets)
      .values({ userId, ...input })
      .returning();
    const created = rows[0]!; // insert ... returning всегда отдаёт одну строку
    logger.info({ durationMs: Date.now() - t0, userId, id: created.id }, "Preset created");
    return created;
  }

  /** Обновляет пресет (только свой); undefined — если такого у пользователя нет. */
  async update(userId: number, id: number, input: PresetInput): Promise<GenerationPreset | undefined> {
    const t0 = Date.now();
    const rows = await this.database.db
      .update(schema.generationPresets)
      .set(input)
      .where(this.ownedBy(userId, id))
      .returning();
    const updated = rows[0];
    logger.info(
      { durationMs: Date.now() - t0, userId, id, found: Boolean(updated) },
      "Preset update attempted",
    );
    return updated;
  }

  /** Удаляет пресет (только свой). true — если строка была удалена. */
  async delete(userId: number, id: number): Promise<boolean> {
    const t0 = Date.now();
    const rows = await this.database.db
      .delete(schema.generationPresets)
      .where(this.ownedBy(userId, id))
      .returning({ id: schema.generationPresets.id });
    const deleted = rows.length > 0;
    logger.info({ durationMs: Date.now() - t0, userId, id, deleted }, "Preset delete attempted");
    return deleted;
  }

  private ownedBy(userId: number, id: number) {
    return and(eq(schema.generationPresets.id, id), eq(schema.generationPresets.userId, userId));
  }
}
