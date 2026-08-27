import { and, desc, eq, sql } from "drizzle-orm";
import logger from "../../logger.js";
import { decryptField, encryptField, getUserEncryptionKey } from "../../utils/index.js";
import { db, schema } from "../index.js";
import type { Card, CardCategory } from "../schema.js";
import {
  DEFAULT_CARD_CATEGORIES,
  DEFAULT_CARD_PROMPT,
  DEFAULT_CARD_SYSTEM_PROMPT,
} from "./cards.constants.js";
import type { CardInput, CardListItem } from "./types.js";

export { ensureUser } from "../users.js";

/** Шифрует текстовые поля категорий (title/description/content), id/enabled — как есть. */
function encryptCategories(categories: CardCategory[], key: Buffer): CardCategory[] {
  return categories.map((c) => ({
    ...c,
    title: encryptField(c.title, key),
    description: encryptField(c.description, key),
    content: encryptField(c.content, key),
  }));
}

/** Расшифровывает текстовые поля категорий — обратная операция encryptCategories. */
function decryptCategories(categories: CardCategory[], key: Buffer): CardCategory[] {
  return categories.map((c) => ({
    ...c,
    title: decryptField(c.title, key),
    description: decryptField(c.description, key),
    content: decryptField(c.content, key),
  }));
}

/**
 * Расшифровывает systemPrompt, prompt и категории строки карточки для её владельца.
 * systemPrompt — фоллбэк на дефолт: у карточек, созданных до появления этого поля, в колонке
 * пустая строка (миграция не может подставить осмысленный per-user шифротекст), без фоллбэка
 * они молча уходили бы на генерацию с пустым system-сообщением — контракт поблочной генерации
 * (формат ответа, что <example> лишь образец) исчезал бы целиком.
 */
function decryptCardRow(row: Card, userId: number): Card {
  const key = getUserEncryptionKey(userId);
  return {
    ...row,
    systemPrompt: decryptField(row.systemPrompt, key) || DEFAULT_CARD_SYSTEM_PROMPT,
    prompt: decryptField(row.prompt, key),
    categories: decryptCategories(row.categories, key),
  };
}

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

/** Полная карточка по id, только если она принадлежит этому пользователю (расшифрована). */
export async function getCard(userId: number, id: number): Promise<Card | undefined> {
  const rows = await db
    .select()
    .from(schema.cards)
    .where(and(eq(schema.cards.id, id), eq(schema.cards.userId, userId)));
  const row = rows[0];
  return row ? decryptCardRow(row, userId) : undefined;
}

/**
 * Создаёт карточку и возвращает созданную строку (расшифрованную).
 * Пустой prompt/categories от клиента (новая карточка ещё без явных значений) заменяются
 * дефолтной структурой — раньше это было бы DB default колонки, но текст шифруется per-user,
 * поэтому дефолт применяется здесь, на вставке.
 */
export async function createCard(userId: number, input: CardInput): Promise<Card> {
  const t0 = Date.now();
  const key = getUserEncryptionKey(userId);
  const systemPrompt = input.systemPrompt.trim() || DEFAULT_CARD_SYSTEM_PROMPT;
  const prompt = input.prompt.trim() || DEFAULT_CARD_PROMPT;
  const categories = input.categories.length > 0 ? input.categories : DEFAULT_CARD_CATEGORIES;
  const rows = await db
    .insert(schema.cards)
    .values({
      userId,
      name: input.name,
      systemPrompt: encryptField(systemPrompt, key),
      prompt: encryptField(prompt, key),
      categories: encryptCategories(categories, key),
      presetId: input.presetId,
      useWebSearch: input.useWebSearch,
      useAskUser: input.useAskUser,
    })
    .returning();
  const created = rows[0]!;
  logger.info({ durationMs: Date.now() - t0, userId, id: created.id }, "Card created");
  return decryptCardRow(created, userId);
}

/**
 * Обновляет карточку (только свою). Возвращает обновлённую строку (расшифрованную) или undefined,
 * если карточки с таким id у пользователя нет.
 */
export async function updateCard(
  userId: number,
  id: number,
  input: CardInput,
): Promise<Card | undefined> {
  const t0 = Date.now();
  const key = getUserEncryptionKey(userId);
  // Тот же фоллбэк, что в createCard: пустой systemPrompt (например, из CardForm у карточки,
  // у которой это поле ещё не заполнено) не должен затирать контракт поблочной генерации пустотой.
  const systemPrompt = input.systemPrompt.trim() || DEFAULT_CARD_SYSTEM_PROMPT;
  const rows = await db
    .update(schema.cards)
    .set({
      name: input.name,
      systemPrompt: encryptField(systemPrompt, key),
      prompt: encryptField(input.prompt, key),
      categories: encryptCategories(input.categories, key),
      presetId: input.presetId,
      useWebSearch: input.useWebSearch,
      useAskUser: input.useAskUser,
    })
    .where(and(eq(schema.cards.id, id), eq(schema.cards.userId, userId)))
    .returning();
  const updated = rows[0];
  logger.info(
    { durationMs: Date.now() - t0, userId, id, found: Boolean(updated) },
    "Card update attempted",
  );
  return updated ? decryptCardRow(updated, userId) : undefined;
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

/**
 * Сохраняет сгенерированный/отредактированный текст одной категории (только своя карточка).
 * Возвращает обновлённую (расшифрованную) карточку или undefined, если карточка не найдена.
 * Точечная запись вместо полного updateCard — используется хендлером генерации блока, где
 * меняется только content одной категории, а не вся форма.
 */
export async function setCardCategoryContent(
  userId: number,
  id: number,
  categoryId: string,
  content: string,
): Promise<Card | undefined> {
  const card = await getCard(userId, id);
  if (!card) return undefined;
  const categories = card.categories.map((c) => (c.id === categoryId ? { ...c, content } : c));
  return updateCard(userId, id, {
    name: card.name,
    systemPrompt: card.systemPrompt,
    prompt: card.prompt,
    categories,
    presetId: card.presetId,
    useWebSearch: card.useWebSearch,
    useAskUser: card.useAskUser,
  });
}
