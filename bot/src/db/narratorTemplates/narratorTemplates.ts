import { and, desc, eq, sql } from "drizzle-orm";
import logger from "../../logger.js";
import { db, schema } from "../index.js";
import type { NarratorTemplate } from "../schema.js";
import type { NarratorTemplateInput, NarratorTemplateListRow } from "./types.js";

/** Список narrator-шаблонов пользователя (свежие сверху). Текстовые поля — только для подсчёта токенов. */
export async function listNarratorTemplates(userId: number): Promise<NarratorTemplateListRow[]> {
  const rows = await db
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
  return rows;
}

/** Сколько шаблонов у пользователя (мягкий лимит). */
export async function countNarratorTemplates(userId: number): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.narratorTemplates)
    .where(eq(schema.narratorTemplates.userId, userId));
  return rows[0]?.count ?? 0;
}

/** Полный шаблон по id, только если принадлежит пользователю. */
export async function getNarratorTemplate(
  userId: number,
  id: number,
): Promise<NarratorTemplate | undefined> {
  const rows = await db
    .select()
    .from(schema.narratorTemplates)
    .where(and(eq(schema.narratorTemplates.id, id), eq(schema.narratorTemplates.userId, userId)));
  return rows[0];
}

/** Создаёт шаблон и возвращает созданную строку. */
export async function createNarratorTemplate(
  userId: number,
  input: NarratorTemplateInput,
): Promise<NarratorTemplate> {
  const t0 = Date.now();
  const rows = await db
    .insert(schema.narratorTemplates)
    .values({ userId, ...input })
    .returning();
  const created = rows[0]!;
  logger.info({ durationMs: Date.now() - t0, userId, id: created.id }, "Narrator template created");
  return created;
}

/** Обновляет шаблон (только свой). undefined — если не найден. */
export async function updateNarratorTemplate(
  userId: number,
  id: number,
  input: NarratorTemplateInput,
): Promise<NarratorTemplate | undefined> {
  const t0 = Date.now();
  const rows = await db
    .update(schema.narratorTemplates)
    .set(input)
    .where(and(eq(schema.narratorTemplates.id, id), eq(schema.narratorTemplates.userId, userId)))
    .returning();
  const updated = rows[0];
  logger.info({ durationMs: Date.now() - t0, userId, id, found: Boolean(updated) }, "Narrator template update attempted");
  return updated;
}

/** Удаляет шаблон (только свой). true — если удалён. */
export async function deleteNarratorTemplate(userId: number, id: number): Promise<boolean> {
  const t0 = Date.now();
  const rows = await db
    .delete(schema.narratorTemplates)
    .where(and(eq(schema.narratorTemplates.id, id), eq(schema.narratorTemplates.userId, userId)))
    .returning({ id: schema.narratorTemplates.id });
  const deleted = rows.length > 0;
  logger.info({ durationMs: Date.now() - t0, userId, id, deleted }, "Narrator template delete attempted");
  return deleted;
}
