import { and, desc, eq, sql } from "drizzle-orm";
import logger from "../logger.js";
import { db, schema } from "./index.js";
import type { GenerationPreset, PromptOrderItem } from "./schema.js";

/**
 * Поля пресета, приходящие из формы Mini App (без серверных id/timestamps). Параметры сэмплинга —
 * `number | null`, где null = «не передавать значение». Имена совпадают с колонками БД и с будущим
 * телом запроса к OpenRouter, чтобы маппинг при подключении генерации был тривиальным.
 */
export type PresetInput = {
  name: string;
  contextUnlimited: boolean;
  contextSize: number | null;
  maxTokens: number | null;
  streaming: boolean;
  temperature: number | null;
  topP: number | null;
  topK: number | null;
  frequencyPenalty: number | null;
  presencePenalty: number | null;
  repetitionPenalty: number | null;
  minP: number | null;
  topA: number | null;
  systemPrompt: string;
  auxiliarySystemPrompt: string;
  postHistoryInstruction: string;
  userPersonaPrompt: string;
  requestReasoning: boolean;
  reasoningEffort: string | null;
  promptOrder: PromptOrderItem[];
};

/** Лёгкая строка списка: только id и название (тексты/параметры не тянем). */
export type PresetListItem = {
  id: number;
  name: string;
};

/** Список пресетов пользователя — свежие сверху. */
export async function listPresets(userId: number): Promise<PresetListItem[]> {
  const t0 = Date.now();
  const rows = await db
    .select({ id: schema.generationPresets.id, name: schema.generationPresets.name })
    .from(schema.generationPresets)
    .where(eq(schema.generationPresets.userId, userId))
    .orderBy(desc(schema.generationPresets.updatedAt));
  logger.debug({ durationMs: Date.now() - t0, userId, count: rows.length }, "Presets listed");
  return rows;
}

/** Сколько пресетов у пользователя (для проверки мягкого лимита). */
export async function countPresets(userId: number): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.generationPresets)
    .where(eq(schema.generationPresets.userId, userId));
  return rows[0]?.count ?? 0;
}

/** Полный пресет по id, только если он принадлежит этому пользователю. */
export async function getPreset(
  userId: number,
  id: number,
): Promise<GenerationPreset | undefined> {
  const rows = await db
    .select()
    .from(schema.generationPresets)
    .where(
      and(eq(schema.generationPresets.id, id), eq(schema.generationPresets.userId, userId)),
    );
  return rows[0];
}

/** Создаёт пресет и возвращает созданную строку. */
export async function createPreset(
  userId: number,
  input: PresetInput,
): Promise<GenerationPreset> {
  const t0 = Date.now();
  const rows = await db
    .insert(schema.generationPresets)
    .values({ userId, ...input })
    .returning();
  const created = rows[0]!; // insert ... returning всегда отдаёт одну строку
  logger.info({ durationMs: Date.now() - t0, userId, id: created.id }, "Preset created");
  return created;
}

/**
 * Обновляет пресет (только свой). Возвращает обновлённую строку или undefined,
 * если пресета с таким id у пользователя нет.
 */
export async function updatePreset(
  userId: number,
  id: number,
  input: PresetInput,
): Promise<GenerationPreset | undefined> {
  const t0 = Date.now();
  const rows = await db
    .update(schema.generationPresets)
    .set(input)
    .where(
      and(eq(schema.generationPresets.id, id), eq(schema.generationPresets.userId, userId)),
    )
    .returning();
  const updated = rows[0];
  logger.info(
    { durationMs: Date.now() - t0, userId, id, found: Boolean(updated) },
    "Preset update attempted",
  );
  return updated;
}

/** Удаляет пресет (только свой). true — если строка была удалена. */
export async function deletePreset(userId: number, id: number): Promise<boolean> {
  const t0 = Date.now();
  const rows = await db
    .delete(schema.generationPresets)
    .where(
      and(eq(schema.generationPresets.id, id), eq(schema.generationPresets.userId, userId)),
    )
    .returning({ id: schema.generationPresets.id });
  const deleted = rows.length > 0;
  logger.info({ durationMs: Date.now() - t0, userId, id, deleted }, "Preset delete attempted");
  return deleted;
}
