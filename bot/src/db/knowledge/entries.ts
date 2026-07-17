import { and, asc, eq, sql } from "drizzle-orm";
import logger from "../../logger.js";
import { decryptField, encryptField, getUserEncryptionKey } from "../../utils/index.js";
import { db, schema } from "../index.js";
import { isPermutationOf } from "./entriesOrder.js";
import type { EntryInput, EntryListItem, PromptEntry } from "./types.js";

/** Подзапрос «книги этого пользователя» — для проверки владения записью без явного join. */
function ownedBooks(userId: number) {
  return sql`(SELECT id FROM knowledge_books WHERE user_id = ${userId})`;
}

/**
 * Резолв плейсхолдеров для narrator-промпта: {{char}} → имя персонажа, {{user}} → имя персоны;
 * недостающая сторона (в narrator-режиме нет ни закреплённого персонажа, ни отыгрываемой персоны)
 * закрывается alias, заданным вручную при выборе персонажа/персоны в записи книги. Пустой alias
 * (записи без соответствующего плейсхолдера в промпте) просто вырезает токен. Регистронезависимо,
 * как replacePlaceholders в RP.
 */
function subPlaceholders(text: string, charName: string, userName: string): string {
  return text.replace(/\{\{char\}\}/gi, charName).replace(/\{\{user\}\}/gi, userName);
}

/**
 * Записи книги для UI (с резолвом персонажа/персоны). Проверяет владение книгой. name/content/keywords
 * зашифрованы per-user — расшифровываем; имя персонажа/персоны берём из characters/personas (name там
 * в открытом виде).
 */
export async function listEntries(userId: number, bookId: number): Promise<EntryListItem[]> {
  const t0 = Date.now();
  const rows = await db.execute(sql`
    SELECT
      e.id, e.name, e.enabled, e.activation, e.character_id, e.persona_id,
      e.alias, e.content, e.keywords, e.keyword_depth, e.sort_order,
      ch.name AS char_name,
      ch.image IS NOT NULL AS char_has_image,
      pe.name AS persona_name,
      pe.image IS NOT NULL AS persona_has_image
    FROM knowledge_book_entries e
    LEFT JOIN characters ch ON ch.id = e.character_id
    LEFT JOIN personas pe ON pe.id = e.persona_id
    WHERE e.book_id = ${bookId}
      AND e.book_id IN ${ownedBooks(userId)}
    ORDER BY e.sort_order ASC, e.created_at ASC
  `);
  const key = getUserEncryptionKey(userId);
  logger.debug({ durationMs: Date.now() - t0, userId, bookId, count: (rows as unknown[]).length }, "Entries listed");
  return (rows as Record<string, unknown>[]).map((r) => ({
    // bigint из сырого SQL приходит строкой — приводим явно (как characterId/personaId ниже).
    id: Number(r.id),
    name: decryptField(r.name as string, key),
    enabled: r.enabled as boolean,
    activation: r.activation as "always_on" | "keyword",
    characterId: r.character_id != null ? Number(r.character_id) : null,
    characterName: (r.char_name as string | null) ?? null,
    characterHasImage: (r.char_has_image as boolean | null) ?? false,
    personaId: r.persona_id != null ? Number(r.persona_id) : null,
    personaName: (r.persona_name as string | null) ?? null,
    personaHasImage: (r.persona_has_image as boolean | null) ?? false,
    alias: decryptField(r.alias as string, key),
    content: decryptField(r.content as string, key),
    keywords: ((r.keywords as string[] | null) ?? []).map((k) => decryptField(k, key)),
    keywordDepth: r.keyword_depth as number,
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

  // Порядок записи определяет сервер: новая падает в хвост (sort_order = число уже существующих).
  // Порядком владеет только reorderEntries. В «старых» книгах, где у всех sort_order = 0, новая
  // получит count > 0 и детерминированно встанет в конец списка.
  const sortOrder = await countEntries(userId, bookId);

  const key = getUserEncryptionKey(userId);
  const rows = await db
    .insert(schema.knowledgeBookEntries)
    .values({
      bookId,
      name: encryptField(input.name, key),
      enabled: input.enabled,
      activation: input.activation,
      characterId: input.characterId,
      personaId: input.personaId,
      alias: encryptField(input.alias, key),
      content: encryptField(input.content, key),
      keywords: input.keywords.map((k) => encryptField(k, key)),
      keywordDepth: input.keywordDepth,
      sortOrder,
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
      personaId: input.personaId,
      alias: encryptField(input.alias, key),
      content: encryptField(input.content, key),
      keywords: input.keywords.map((k) => encryptField(k, key)),
      keywordDepth: input.keywordDepth,
      // sort_order НЕ трогаем — порядком владеет только reorderEntries, правка записи его не сбивает.
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
 * Переставляет записи книги в порядок orderedIds (id в новом порядке). Возвращает "invalid", если
 * orderedIds — не ровно перестановка текущих id записей книги (тот же набор, без чужих/дублей/
 * пропусков): защита от порчи порядка при рассинхроне клиента. sort_order переписывается плотно
 * 0,1,2… одним атомарным UPDATE ... FROM (VALUES …). Владение книгой проверяется через ownedBooks.
 */
export async function reorderEntries(
  userId: number,
  bookId: number,
  orderedIds: number[],
): Promise<"ok" | "invalid"> {
  const t0 = Date.now();
  // SELECT текущих id и UPDATE — в одной транзакции: иначе параллельное создание/удаление записи
  // между ними прошло бы проверку перестановки, но применилось бы к устаревшему набору.
  const result = await db.transaction(async (tx) => {
    const current = await tx.execute(sql`
      SELECT id FROM knowledge_book_entries
      WHERE book_id = ${bookId} AND book_id IN ${ownedBooks(userId)}
    `);
    // bigint из сырого SQL приходит строкой — приводим явно (как в listEntries).
    const currentIds = (current as Record<string, unknown>[]).map((r) => Number(r.id));
    if (!isPermutationOf(orderedIds, currentIds)) return "invalid" as const;
    if (orderedIds.length === 0) return "ok" as const; // пустая книга — переставлять нечего

    // (id, позиция) списком; оба параметра кастуем, иначе тип колонок VALUES остаётся unknown.
    const values = orderedIds.map((id, i) => sql`(${id}::bigint, ${i}::int)`);
    await tx.execute(sql`
      UPDATE knowledge_book_entries AS e
      SET sort_order = v.ord, updated_at = now()
      FROM (VALUES ${sql.join(values, sql`, `)}) AS v(id, ord)
      WHERE e.id = v.id
        AND e.book_id = ${bookId}
        AND e.book_id IN ${ownedBooks(userId)}
    `);
    return "ok" as const;
  });

  if (result === "invalid") {
    logger.warn({ userId, bookId, given: orderedIds.length }, "Entry reorder rejected: not a permutation");
  } else {
    logger.info({ durationMs: Date.now() - t0, userId, bookId, count: orderedIds.length }, "Entries reordered");
  }
  return result;
}

/**
 * Включённые записи книги, готовые к подстановке в промпт. Для записи-персонажа/персоны текст
 * собирается из карточки/персоны (описание, расшифрованное), для свободной — из content. Приоритет
 * веток: персонаж → персона → свободный текст (ровно одна должна быть заполнена, гарантирует
 * валидация контроллера). Итог оборачивается в блок <имя записи>…</имя записи> — так LLM видит, к
 * какому факту/персонажу/персоне относится текст, и записи не сливаются в промпте друг с другом.
 * Фильтрацию по activation (always_on vs keyword) делает сборщик промпта.
 */
export async function getActiveEntriesForPrompt(
  userId: number,
  bookId: number,
): Promise<PromptEntry[]> {
  const t0 = Date.now();
  const rows = await db.execute(sql`
    SELECT
      e.name, e.activation, e.content, e.keywords, e.keyword_depth, e.character_id, e.persona_id, e.alias,
      ch.name AS char_name, ch.prompt AS char_prompt,
      pe.name AS persona_name, pe.prompt AS persona_prompt
    FROM knowledge_book_entries e
    LEFT JOIN characters ch ON ch.id = e.character_id
    LEFT JOIN personas pe ON pe.id = e.persona_id
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
    const alias = decryptField(r.alias as string, key);

    let body: string;
    if (r.character_id != null && r.char_name != null) {
      // Запись-персонаж: в промпт идёт только описание из карточки (prompt зашифрован как у character).
      // Имя не дублируем — его несёт оборачивающий тег <name>; сценарий карточки в книгу знаний не тянем.
      body = subPlaceholders(decryptField((r.char_prompt as string | null) ?? "", key), r.char_name as string, alias);
    } else if (r.persona_id != null && r.persona_name != null) {
      // Запись-персона: симметрично записи-персонажу, {{char}} закрывается alias.
      body = subPlaceholders(
        decryptField((r.persona_prompt as string | null) ?? "", key),
        alias,
        r.persona_name as string,
      );
    } else {
      body = decryptField((r.content as string | null) ?? "", key);
    }
    const text = `<${entryName}>\n${body}\n</${entryName}>`;
    return { activation, keywords, keywordDepth: r.keyword_depth as number, text };
  });
}
