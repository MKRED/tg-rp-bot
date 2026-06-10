import { and, desc, eq, sql } from "drizzle-orm";
import logger from "../logger.js";
import { db, schema } from "./index.js";
import type { Persona } from "./schema.js";

export { ensureUser } from "./users.js";

/**
 * Поля персоны, которые приходят из формы Mini App (без серверных id/timestamps).
 * footnote хранится только в интерфейсе — в LLM-запрос не передаётся.
 */
export type PersonaInput = {
  name: string;
  prompt: string;
  footnote: string | null;
  image: string | null;
};

/**
 * Лёгкая проекция для списка: без image (может весить сотни КБ base64),
 * вместо него флаг hasImage — картинку список грузит построчно через GET /:id/image.
 */
export type PersonaListItem = {
  id: number;
  name: string;
  footnote: string | null;
  hasImage: boolean;
};

/** Список персон пользователя (метаданные, без image) — свежие сверху. */
export async function listPersonas(userId: number): Promise<PersonaListItem[]> {
  const t0 = Date.now();
  const rows = await db
    .select({
      id: schema.personas.id,
      name: schema.personas.name,
      footnote: schema.personas.footnote,
      hasImage: sql<boolean>`${schema.personas.image} is not null`,
    })
    .from(schema.personas)
    .where(eq(schema.personas.userId, userId))
    .orderBy(desc(schema.personas.updatedAt));
  logger.debug({ durationMs: Date.now() - t0, userId, count: rows.length }, "Personas listed");
  return rows;
}

/** Сколько персон у пользователя (для проверки мягкого лимита). */
export async function countPersonas(userId: number): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.personas)
    .where(eq(schema.personas.userId, userId));
  return rows[0]?.count ?? 0;
}

/** Полная персона по id, только если она принадлежит этому пользователю. */
export async function getPersona(userId: number, id: number): Promise<Persona | undefined> {
  const rows = await db
    .select()
    .from(schema.personas)
    .where(and(eq(schema.personas.id, id), eq(schema.personas.userId, userId)));
  return rows[0];
}

/**
 * Только аватар персоны (одна колонка) для построчной загрузки картинки в списке.
 * Возвращает: undefined — персоны нет/не его; null — есть, но без картинки; string — data URL.
 */
export async function getPersonaImage(
  userId: number,
  id: number,
): Promise<string | null | undefined> {
  const rows = await db
    .select({ image: schema.personas.image })
    .from(schema.personas)
    .where(and(eq(schema.personas.id, id), eq(schema.personas.userId, userId)));
  return rows[0]?.image;
}

/** Создаёт персону и возвращает созданную строку. */
export async function createPersona(userId: number, input: PersonaInput): Promise<Persona> {
  const t0 = Date.now();
  const rows = await db
    .insert(schema.personas)
    .values({
      userId,
      name: input.name,
      prompt: input.prompt,
      footnote: input.footnote,
      image: input.image,
    })
    .returning();
  const created = rows[0]!;
  logger.info({ durationMs: Date.now() - t0, userId, id: created.id }, "Persona created");
  return created;
}

/**
 * Обновляет персону (только свою). Возвращает обновлённую строку или undefined,
 * если персоны с таким id у пользователя нет.
 */
export async function updatePersona(
  userId: number,
  id: number,
  input: PersonaInput,
): Promise<Persona | undefined> {
  const t0 = Date.now();
  const rows = await db
    .update(schema.personas)
    .set({
      name: input.name,
      prompt: input.prompt,
      footnote: input.footnote,
      image: input.image,
    })
    .where(and(eq(schema.personas.id, id), eq(schema.personas.userId, userId)))
    .returning();
  const updated = rows[0];
  logger.info(
    { durationMs: Date.now() - t0, userId, id, found: Boolean(updated) },
    "Persona update attempted",
  );
  return updated;
}

/** Удаляет персону (только свою). true — если строка была удалена. */
export async function deletePersona(userId: number, id: number): Promise<boolean> {
  const t0 = Date.now();
  const rows = await db
    .delete(schema.personas)
    .where(and(eq(schema.personas.id, id), eq(schema.personas.userId, userId)))
    .returning({ id: schema.personas.id });
  const deleted = rows.length > 0;
  logger.info({ durationMs: Date.now() - t0, userId, id, deleted }, "Persona delete attempted");
  return deleted;
}
