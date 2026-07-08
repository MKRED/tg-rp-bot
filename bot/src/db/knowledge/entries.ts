import { and, asc, eq, sql } from "drizzle-orm";
import logger from "../../logger.js";
import { decryptField, encryptField, getUserEncryptionKey } from "../../utils/index.js";
import { db, schema } from "../index.js";
import type { EntryInput, EntryListItem, PromptEntry } from "./types.js";

/** Подзапрос «книги этого пользователя» — для проверки владения записью без явного join. */
function ownedBooks(userId: number) {
  return sql`(SELECT id FROM knowledge_books WHERE user_id = ${userId})`;
}

/**
 * Резолв плейсхолдеров карточки персонажа для narrator-промпта: {{char}} → имя персонажа записи,
 * {{user}} → userAlias, заданный при выборе персонажа в записи книги (в narrator-режиме нет
 * отыгрываемой персоны — пользователь режиссёр, поэтому значение вводится вручную). Пустой userAlias
 * (записи без плейсхолдера в промпте) просто вырезает токен. Регистронезависимо, как replacePlaceholders в RP.
 */
function subPlaceholders(text: string, charName: string, userAlias: string): string {
  return text.replace(/\{\{char\}\}/gi, charName).replace(/\{\{user\}\}/gi, userAlias);
}

/**
 * Записи книги для UI (с резолвом персонажа). Проверяет владение книгой. name/content/keywords
 * зашифрованы per-user — расшифровываем; имя персонажа берём из characters (name там в открытом виде).
 */
export async function listEntries(userId: number, bookId: number): Promise<EntryListItem[]> {
  const t0 = Date.now();
  const rows = await db.execute(sql`
    SELECT
      e.id, e.name, e.enabled, e.activation, e.character_id,
      e.user_alias, e.content, e.keywords, e.sort_order,
      ch.name AS char_name,
      ch.image IS NOT NULL AS char_has_image
    FROM knowledge_book_entries e
    LEFT JOIN characters ch ON ch.id = e.character_id
    WHERE e.book_id = ${bookId}
      AND e.book_id IN ${ownedBooks(userId)}
    ORDER BY e.sort_order ASC, e.created_at ASC
  `);
  const key = getUserEncryptionKey(userId);
  logger.debug({ durationMs: Date.now() - t0, userId, bookId, count: (rows as unknown[]).length }, "Entries listed");
  return (rows as Record<string, unknown>[]).map((r) => ({
    // bigint из сырого SQL приходит строкой — приводим явно (как characterId ниже).
    id: Number(r.id),
    name: decryptField(r.name as string, key),
    enabled: r.enabled as boolean,
    activation: r.activation as "always_on" | "keyword",
    characterId: r.character_id != null ? Number(r.character_id) : null,
    characterName: (r.char_name as string | null) ?? null,
    characterHasImage: (r.char_has_image as boolean | null) ?? false,
    userAlias: decryptField(r.user_alias as string, key),
    content: decryptField(r.content as string, key),
    keywords: ((r.keywords as string[] | null) ?? []).map((k) => decryptField(k, key)),
    sortOrder: r.sort_order as number,
  }));
}

/** Сколько записей в книге пользователя (для мягкого лимита, без декрипта). */
export async function countEntries(userId: number, bookId: number): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.knowledgeBookEntries)
    .where(
      and(
        eq(schema.knowledgeBookEntries.bookId, bookId),
        sql`${schema.knowledgeBookEntries.bookId} IN ${ownedBooks(userId)}`,
      ),
    );
  return rows[0]?.count ?? 0;
}

/** Создаёт запись в книге (проверяя владение книгой). undefined — книги нет/не его. */
export async function createEntry(
  userId: number,
  bookId: number,
  input: EntryInput,
): Promise<{ id: number } | undefined> {
  const t0 = Date.now();
  const owns = await db
    .select({ id: schema.knowledgeBooks.id })
    .from(schema.knowledgeBooks)
    .where(and(eq(schema.knowledgeBooks.id, bookId), eq(schema.knowledgeBooks.userId, userId)));
  if (owns.length === 0) return undefined;

  const key = getUserEncryptionKey(userId);
  const rows = await db
    .insert(schema.knowledgeBookEntries)
    .values({
      bookId,
      name: encryptField(input.name, key),
      enabled: input.enabled,
      activation: input.activation,
      characterId: input.characterId,
      userAlias: encryptField(input.userAlias, key),
      content: encryptField(input.content, key),
      keywords: input.keywords.map((k) => encryptField(k, key)),
      sortOrder: input.sortOrder,
    })
    .returning({ id: schema.knowledgeBookEntries.id });
  logger.info({ durationMs: Date.now() - t0, userId, bookId, entryId: rows[0]!.id }, "Book entry created");
  return { id: rows[0]!.id };
}

/** Обновляет запись (только в книге пользователя). false — если не найдена. */
export async function updateEntry(
  userId: number,
  entryId: number,
  input: EntryInput,
): Promise<boolean> {
  const t0 = Date.now();
  const key = getUserEncryptionKey(userId);
  const rows = await db
    .update(schema.knowledgeBookEntries)
    .set({
      name: encryptField(input.name, key),
      enabled: input.enabled,
      activation: input.activation,
      characterId: input.characterId,
      userAlias: encryptField(input.userAlias, key),
      content: encryptField(input.content, key),
      keywords: input.keywords.map((k) => encryptField(k, key)),
      sortOrder: input.sortOrder,
    })
    .where(
      and(
        eq(schema.knowledgeBookEntries.id, entryId),
        sql`${schema.knowledgeBookEntries.bookId} IN ${ownedBooks(userId)}`,
      ),
    )
    .returning({ id: schema.knowledgeBookEntries.id });
  const updated = rows.length > 0;
  logger.info({ durationMs: Date.now() - t0, userId, entryId, found: updated }, "Book entry update attempted");
  return updated;
}

/** Удаляет запись (только в книге пользователя). true — если удалена. */
export async function deleteEntry(userId: number, entryId: number): Promise<boolean> {
  const t0 = Date.now();
  const rows = await db
    .delete(schema.knowledgeBookEntries)
    .where(
      and(
        eq(schema.knowledgeBookEntries.id, entryId),
        sql`${schema.knowledgeBookEntries.bookId} IN ${ownedBooks(userId)}`,
      ),
    )
    .returning({ id: schema.knowledgeBookEntries.id });
  const deleted = rows.length > 0;
  logger.info({ durationMs: Date.now() - t0, userId, entryId, deleted }, "Book entry delete attempted");
  return deleted;
}

/**
 * Включённые записи книги, готовые к подстановке в промпт. Для записи-персонажа текст собирается из
 * карточки (имя + описание + сценарий, расшифрованные), для свободной — из content. Итог оборачивается
 * в блок <имя записи>…</имя записи> — так LLM видит, к какому факту/персонажу относится текст, и записи
 * не сливаются в промпте друг с другом. Фильтрацию по activation (always_on vs keyword) делает сборщик промпта.
 */
export async function getActiveEntriesForPrompt(
  userId: number,
  bookId: number,
): Promise<PromptEntry[]> {
  const t0 = Date.now();
  const rows = await db.execute(sql`
    SELECT
      e.name, e.activation, e.content, e.keywords, e.character_id, e.user_alias,
      ch.name AS char_name, ch.prompt AS char_prompt
    FROM knowledge_book_entries e
    LEFT JOIN characters ch ON ch.id = e.character_id
    WHERE e.book_id = ${bookId}
      AND e.book_id IN ${ownedBooks(userId)}
      AND e.enabled = true
    ORDER BY e.sort_order ASC, e.created_at ASC
  `);
  const key = getUserEncryptionKey(userId);
  logger.debug(
    { durationMs: Date.now() - t0, userId, bookId, count: (rows as unknown[]).length },
    "Active book entries loaded for prompt",
  );

  return (rows as Record<string, unknown>[]).map((r) => {
    const activation = r.activation as "always_on" | "keyword";
    const keywords = ((r.keywords as string[] | null) ?? []).map((k) => decryptField(k, key));
    const entryName = decryptField(r.name as string, key);

    let body: string;
    if (r.character_id != null && r.char_name != null) {
      // Запись-персонаж: в промпт идёт только описание из карточки (prompt зашифрован как у character).
      // Имя не дублируем — его несёт оборачивающий тег <name>; сценарий карточки в книгу знаний не тянем.
      const charName = r.char_name as string;
      const userAlias = decryptField(r.user_alias as string, key);
      body = subPlaceholders(
        decryptField((r.char_prompt as string | null) ?? "", key),
        charName,
        userAlias,
      );
    } else {
      body = decryptField((r.content as string | null) ?? "", key);
    }
    const text = `<${entryName}>\n${body}\n</${entryName}>`;
    return { activation, keywords, text };
  });
}
