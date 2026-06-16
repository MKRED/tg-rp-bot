import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "../index.js";

/**
 * Рекурсивный CTE: путь от листа (messageId) к корню + sibling-информация для каждого узла пути.
 * Вынесен в одну функцию, чтобы getChat не дублировал этот запрос в ветке самовосстановления.
 *
 * COALESCE(parent_id, -1) позволяет корню (parent_id IS NULL) попасть в одну group с
 * другими корнями через дополнительную группировку. Возвращает сырые строки —
 * расшифровку content/translations делает вызывающая сторона (нужен per-user ключ).
 */
export async function queryActivePath(
  chatId: number,
  messageId: number,
): Promise<Record<string, unknown>[]> {
  const rows = await db.execute(sql`
    WITH RECURSIVE path AS (
      SELECT * FROM messages WHERE id = ${messageId}
      UNION ALL
      SELECT m.* FROM messages m JOIN path p ON m.id = p.parent_id
    ),
    sibling_info AS (
      SELECT
        id,
        COALESCE(parent_id, -1)                                        AS group_key,
        COUNT(*)   OVER (PARTITION BY COALESCE(parent_id, -1))::int    AS sibling_count,
        (ROW_NUMBER() OVER (PARTITION BY COALESCE(parent_id, -1)
                            ORDER BY created_at) - 1)::int             AS sibling_index
      FROM messages WHERE chat_id = ${chatId}
    ),
    sibling_arrays AS (
      SELECT
        COALESCE(parent_id, -1)            AS group_key,
        ARRAY_AGG(id ORDER BY created_at)  AS siblings
      FROM messages
      WHERE chat_id = ${chatId}
      GROUP BY COALESCE(parent_id, -1)
    )
    SELECT
      p.id, p.parent_id, p.role, p.content, p.translations, p.created_at,
      s.sibling_count, s.sibling_index, sa.siblings
    FROM path p
    JOIN sibling_info s  ON s.id        = p.id
    JOIN sibling_arrays sa ON sa.group_key = COALESCE(p.parent_id, -1)
    ORDER BY p.created_at ASC
  `);
  return rows as Record<string, unknown>[];
}

/** Последний лист дерева (узел без детей), самый свежий. Нужен для самовосстановления курсора. */
export async function findLastLeaf(chatId: number): Promise<number | null> {
  const leafRows = await db.execute(sql`
    SELECT id FROM messages
    WHERE chat_id = ${chatId}
      AND id NOT IN (
        SELECT DISTINCT parent_id FROM messages
        WHERE parent_id IS NOT NULL AND chat_id = ${chatId}
      )
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const leafId = (leafRows as unknown as { id: unknown }[])[0]?.id;
  return leafId != null ? Number(leafId) : null;
}

/**
 * Рекурсивно спускается к листу дерева, следуя самому свежему ребёнку.
 * Нужно при переключении ветки в середине дерева — сохраняем существующее продолжение.
 */
export async function findLeaf(chatId: number, messageId: number): Promise<number> {
  let current = messageId;
  for (;;) {
    const children = await db
      .select({ id: schema.messages.id })
      .from(schema.messages)
      .where(
        and(
          eq(schema.messages.parentId, current),
          eq(schema.messages.chatId, chatId),
        ),
      )
      .orderBy(desc(schema.messages.createdAt))
      .limit(1);
    if (children.length === 0) return current;
    current = children[0]!.id;
  }
}

/** Собирает ID активного пути (только ID) от листа к корню — для флага isOnActivePath в графе. */
export async function queryActivePathIds(activeMessageId: number): Promise<Set<number>> {
  const pathRows = await db.execute(sql`
    WITH RECURSIVE path AS (
      SELECT id, parent_id FROM messages WHERE id = ${activeMessageId}
      UNION ALL
      SELECT m.id, m.parent_id FROM messages m JOIN path p ON m.id = p.parent_id
    )
    SELECT id FROM path
  `);
  return new Set((pathRows as unknown as { id: unknown }[]).map((r) => Number(r.id)));
}
