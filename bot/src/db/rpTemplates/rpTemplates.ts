import { and, desc, eq, sql } from "drizzle-orm";
import logger from "../../logger.js";
import { db, schema } from "../index.js";
import type { RpTemplate } from "../schema.js";
import type { RpTemplateInput, RpTemplateListRow } from "./types.js";

/** Список RP-шаблонов пользователя (свежие сверху). Текстовые поля — только для подсчёта токенов. */
export async function listRpTemplates(userId: number): Promise<RpTemplateListRow[]> {
  const rows = await db
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
  return rows;
}

/** Сколько шаблонов у пользователя (мягкий лимит). */
export async function countRpTemplates(userId: number): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.rpTemplates)
    .where(eq(schema.rpTemplates.userId, userId));
  return rows[0]?.count ?? 0;
}

/** Полный шаблон по id, только если принадлежит пользователю. */
export async function getRpTemplate(userId: number, id: number): Promise<RpTemplate | undefined> {
  const rows = await db
    .select()
    .from(schema.rpTemplates)
    .where(and(eq(schema.rpTemplates.id, id), eq(schema.rpTemplates.userId, userId)));
  return rows[0];
}

/** Создаёт шаблон и возвращает созданную строку. */
export async function createRpTemplate(
  userId: number,
  input: RpTemplateInput,
): Promise<RpTemplate> {
  const t0 = Date.now();
  const rows = await db
    .insert(schema.rpTemplates)
    .values({ userId, ...input })
    .returning();
  const created = rows[0]!;
  logger.info({ durationMs: Date.now() - t0, userId, id: created.id }, "RP template created");
  return created;
}

/** Обновляет шаблон (только свой). undefined — если не найден. */
export async function updateRpTemplate(
  userId: number,
  id: number,
  input: RpTemplateInput,
): Promise<RpTemplate | undefined> {
  const t0 = Date.now();
  const rows = await db
    .update(schema.rpTemplates)
    .set(input)
    .where(and(eq(schema.rpTemplates.id, id), eq(schema.rpTemplates.userId, userId)))
    .returning();
  const updated = rows[0];
  logger.info(
    { durationMs: Date.now() - t0, userId, id, found: Boolean(updated) },
    "RP template update attempted",
  );
  return updated;
}

/** Удаляет шаблон (только свой). true — если удалён. */
export async function deleteRpTemplate(userId: number, id: number): Promise<boolean> {
  const t0 = Date.now();
  const rows = await db
    .delete(schema.rpTemplates)
    .where(and(eq(schema.rpTemplates.id, id), eq(schema.rpTemplates.userId, userId)))
    .returning({ id: schema.rpTemplates.id });
  const deleted = rows.length > 0;
  logger.info({ durationMs: Date.now() - t0, userId, id, deleted }, "RP template delete attempted");
  return deleted;
}
