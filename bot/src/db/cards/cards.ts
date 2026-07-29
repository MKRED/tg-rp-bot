import { and, desc, eq, sql } from "drizzle-orm";
import logger from "../../logger.js";
import { db, schema } from "../index.js";
import type { Card } from "../schema.js";
import type { CardInput, CardListItem } from "./types.js";

export { ensureUser } from "../users.js";

/** Список карточек пользователя — свежие сверху. */
export async function listCards(userId: number): Promise<CardListItem[]> {
  const t0 = Date.now();
  const rows = await db
    .select({
      id: schema.cards.id,
      name: schema.cards.name,
      updatedAt: schema.cards.updatedAt,
    })
    .from(schema.cards)
    .where(eq(schema.cards.userId, userId))
    .orderBy(desc(schema.cards.updatedAt));
  logger.debug({ durationMs: Date.now() - t0, userId, count: rows.length }, "Cards listed");
  return rows;
}

/** Сколько карточек у пользователя (для проверки мягкого лимита). */
export async function countCards(userId: number): Promise<number> {
  const t0 = Date.now();
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.cards)
    .where(eq(schema.cards.userId, userId));
  const count = rows[0]?.count ?? 0;
  logger.debug({ durationMs: Date.now() - t0, userId, count }, "Cards counted");
  return count;
}

/** Полная карточка по id, только если она принадлежит этому пользователю. */
export async function getCard(userId: number, id: number): Promise<Card | undefined> {
  const rows = await db
    .select()
    .from(schema.cards)
    .where(and(eq(schema.cards.id, id), eq(schema.cards.userId, userId)));
  return rows[0];
}

/** Создаёт карточку и возвращает созданную строку. */
export async function createCard(userId: number, input: CardInput): Promise<Card> {
  const t0 = Date.now();
  const rows = await db
    .insert(schema.cards)
    .values({ userId, name: input.name })
    .returning();
  const created = rows[0]!;
  logger.info({ durationMs: Date.now() - t0, userId, id: created.id }, "Card created");
  return created;
}

/**
 * Обновляет карточку (только свою). Возвращает обновлённую строку или undefined,
 * если карточки с таким id у пользователя нет.
 */
export async function updateCard(
  userId: number,
  id: number,
  input: CardInput,
): Promise<Card | undefined> {
  const t0 = Date.now();
  const rows = await db
    .update(schema.cards)
    .set({ name: input.name })
    .where(and(eq(schema.cards.id, id), eq(schema.cards.userId, userId)))
    .returning();
  const updated = rows[0];
  logger.info(
    { durationMs: Date.now() - t0, userId, id, found: Boolean(updated) },
    "Card update attempted",
  );
  return updated;
}

/** Удаляет карточку (только свою). true — если строка была удалена. */
export async function deleteCard(userId: number, id: number): Promise<boolean> {
  const t0 = Date.now();
  const rows = await db
    .delete(schema.cards)
    .where(and(eq(schema.cards.id, id), eq(schema.cards.userId, userId)))
    .returning({ id: schema.cards.id });
  const deleted = rows.length > 0;
  logger.info({ durationMs: Date.now() - t0, userId, id, deleted }, "Card delete attempted");
  return deleted;
}
