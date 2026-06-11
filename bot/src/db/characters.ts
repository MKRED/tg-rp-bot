import { and, desc, eq, sql } from "drizzle-orm";
import logger from "../logger.js";
import { decryptField, encryptField, getUserEncryptionKey } from "../utils/index.js";
import { db, schema } from "./index.js";
import type { Character } from "./schema.js";

// ensureUser вынесен в общий db/users.ts (нужен и пресетам) — реэкспорт сохраняет
// прежнюю точку импорта `../db/characters.js` для server/characters.ts.
export { ensureUser } from "./users.js";

/**
 * Поля персонажа, которые приходят из формы Mini App (без серверных id/timestamps).
 * image — аватар как data URL (или null, если не задан/удалён).
 */
export type CharacterInput = {
  name: string;
  tags: string[];
  prompt: string;
  firstMessages: string[];
  image: string | null;
};

/**
 * Лёгкая проекция для списка: без самого image (он может весить сотни КБ base64), вместо него
 * только флаг hasImage — саму картинку список грузит построчно через GET /characters/:id/image.
 */
export type CharacterListItem = {
  id: number;
  name: string;
  tags: string[];
  firstMessageCount: number;
  hasImage: boolean;
};

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
      // только наличие аватара (не сами байты) — картинку список грузит отдельным запросом
      hasImage: sql<boolean>`${schema.characters.image} is not null`,
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
  const row = rows[0];
  if (!row) return undefined;
  return decryptCharacterRow(row, userId);
}

/**
 * Только аватар персонажа (тянем одну колонку, без промпта/сообщений) для построчной загрузки
 * картинки в списке. Возвращает: undefined — персонажа нет/не его; null — есть, но без картинки;
 * string — data URL аватара.
 */
export async function getCharacterImage(
  userId: number,
  id: number,
): Promise<string | null | undefined> {
  const rows = await db
    .select({ image: schema.characters.image })
    .from(schema.characters)
    .where(and(eq(schema.characters.id, id), eq(schema.characters.userId, userId)));
  return rows[0]?.image;
}

/** Создаёт персонажа и возвращает созданную строку. */
export async function createCharacter(userId: number, input: CharacterInput): Promise<Character> {
  const t0 = Date.now();
  const key = getUserEncryptionKey(userId);
  const rows = await db
    .insert(schema.characters)
    .values({
      userId,
      name: input.name,
      tags: input.tags,
      prompt: encryptField(input.prompt, key),
      firstMessages: input.firstMessages.map((msg) => encryptField(msg, key)),
      image: input.image,
    })
    .returning();
  const created = rows[0]!; // insert ... returning всегда отдаёт одну строку
  logger.info({ durationMs: Date.now() - t0, userId, id: created.id }, "Character created");
  return decryptCharacterRow(created, userId);
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
  const key = getUserEncryptionKey(userId);
  const rows = await db
    .update(schema.characters)
    .set({
      name: input.name,
      tags: input.tags,
      prompt: encryptField(input.prompt, key),
      firstMessages: input.firstMessages.map((msg) => encryptField(msg, key)),
      image: input.image,
    })
    .where(and(eq(schema.characters.id, id), eq(schema.characters.userId, userId)))
    .returning();
  const updated = rows[0];
  logger.info(
    { durationMs: Date.now() - t0, userId, id, found: Boolean(updated) },
    "Character update attempted",
  );
  return updated ? decryptCharacterRow(updated, userId) : undefined;
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

/** Расшифровывает зашифрованные поля строки персонажа. */
function decryptCharacterRow(row: Character, userId: number): Character {
  const key = getUserEncryptionKey(userId);
  return {
    ...row,
    prompt: decryptField(row.prompt, key),
    firstMessages: row.firstMessages.map((msg) => decryptField(msg, key)),
  };
}
