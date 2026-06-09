import { and, desc, eq, sql } from "drizzle-orm";
import type { TgUser } from "../server/initData.js";
import logger from "../logger.js";
import { db, schema } from "./index.js";
import type { Character } from "./schema.js";

/**
 * Поля персонажа, которые приходят из формы Mini App (без серверных id/timestamps).
 * image пока не принимаем из webapp (UI загрузки отложен) — колонка остаётся под будущее.
 */
export type CharacterInput = {
  name: string;
  tags: string[];
  prompt: string;
  firstMessages: string[];
};

/** Лёгкая проекция для списка: без image и без полного текста промпта/сообщений. */
export type CharacterListItem = {
  id: number;
  name: string;
  tags: string[];
  firstMessageCount: number;
};

/**
 * Upsert пользователя перед созданием персонажа: строка в users заводится только на /start
 * (см. handlers/start.ts), а Mini App можно открыть, не нажав /start. Без этого FK
 * characters.user_id → users.id упадёт. Паттерн upsert повторяет /start.
 */
export async function ensureUser(user: NonNullable<TgUser>): Promise<void> {
  const t0 = Date.now();
  await db
    .insert(schema.users)
    .values({
      id: user.id,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      languageCode: user.language_code,
    })
    .onConflictDoUpdate({
      target: schema.users.id,
      set: {
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        languageCode: user.language_code,
        updatedAt: new Date(),
      },
    });
  logger.debug({ durationMs: Date.now() - t0, userId: user.id }, "User ensured for character op");
}

/** Список персонажей пользователя (метаданные, без image) — свежие сверху. */
export async function listCharacters(userId: number): Promise<CharacterListItem[]> {
  const t0 = Date.now();
  const rows = await db
    .select({
      id: schema.characters.id,
      name: schema.characters.name,
      tags: schema.characters.tags,
      // длина jsonb-массива первых сообщений считается на стороне БД — список не тянет тексты
      firstMessageCount: sql<number>`jsonb_array_length(${schema.characters.firstMessages})`,
    })
    .from(schema.characters)
    .where(eq(schema.characters.userId, userId))
    .orderBy(desc(schema.characters.updatedAt));
  logger.debug(
    { durationMs: Date.now() - t0, userId, count: rows.length },
    "Characters listed",
  );
  return rows;
}

/** Сколько персонажей у пользователя (для проверки мягкого лимита). */
export async function countCharacters(userId: number): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.characters)
    .where(eq(schema.characters.userId, userId));
  return rows[0]?.count ?? 0;
}

/** Полный персонаж по id, только если он принадлежит этому пользователю. */
export async function getCharacter(userId: number, id: number): Promise<Character | undefined> {
  const rows = await db
    .select()
    .from(schema.characters)
    .where(and(eq(schema.characters.id, id), eq(schema.characters.userId, userId)));
  return rows[0];
}

/** Создаёт персонажа и возвращает созданную строку. */
export async function createCharacter(userId: number, input: CharacterInput): Promise<Character> {
  const t0 = Date.now();
  const rows = await db
    .insert(schema.characters)
    .values({
      userId,
      name: input.name,
      tags: input.tags,
      prompt: input.prompt,
      firstMessages: input.firstMessages,
    })
    .returning();
  const created = rows[0]!; // insert ... returning всегда отдаёт одну строку
  logger.info({ durationMs: Date.now() - t0, userId, id: created.id }, "Character created");
  return created;
}

/**
 * Обновляет персонажа (только своего). Возвращает обновлённую строку или undefined,
 * если персонажа с таким id у пользователя нет.
 */
export async function updateCharacter(
  userId: number,
  id: number,
  input: CharacterInput,
): Promise<Character | undefined> {
  const t0 = Date.now();
  const rows = await db
    .update(schema.characters)
    .set({
      name: input.name,
      tags: input.tags,
      prompt: input.prompt,
      firstMessages: input.firstMessages,
    })
    .where(and(eq(schema.characters.id, id), eq(schema.characters.userId, userId)))
    .returning();
  const updated = rows[0];
  logger.info(
    { durationMs: Date.now() - t0, userId, id, found: Boolean(updated) },
    "Character update attempted",
  );
  return updated;
}

/** Удаляет персонажа (только своего). true — если строка была удалена. */
export async function deleteCharacter(userId: number, id: number): Promise<boolean> {
  const t0 = Date.now();
  const rows = await db
    .delete(schema.characters)
    .where(and(eq(schema.characters.id, id), eq(schema.characters.userId, userId)))
    .returning({ id: schema.characters.id });
  const deleted = rows.length > 0;
  logger.info({ durationMs: Date.now() - t0, userId, id, deleted }, "Character delete attempted");
  return deleted;
}
