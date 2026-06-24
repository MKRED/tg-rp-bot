import { and, desc, eq, sql } from "drizzle-orm";
import logger from "../../logger.js";
import { db, schema } from "../index.js";

/**
 * Рекурсивный CTE: путь от листа (messageId) к корню + sibling-информация для каждого узла.
 * Зеркало db/chats/queries.ts, но по story_messages (story_chat_id, есть kind, нет translations).
 * Возвращает сырые строки — расшифровку content делает вызывающая сторона (нужен per-user ключ).
 */
export async function queryStoryActivePath(
  storyChatId: number,
  messageId: number,
): Promise<Record<string, unknown>[]> {
  const t0 = Date.now();
  const rows = await db.execute(sql`
    WITH RECURSIVE path AS (
      SELECT * FROM story_messages WHERE id = ${messageId}
      UNION ALL
      SELECT m.* FROM story_messages m JOIN path p ON m.id = p.parent_id
    ),
    sibling_info AS (
      SELECT
        id,
        COUNT(*)   OVER (PARTITION BY COALESCE(parent_id, -1))::int    AS sibling_count,
        (ROW_NUMBER() OVER (PARTITION BY COALESCE(parent_id, -1)
                            ORDER BY created_at) - 1)::int             AS sibling_index
      FROM story_messages WHERE story_chat_id = ${storyChatId}
    ),
    sibling_arrays AS (
      SELECT
        COALESCE(parent_id, -1)            AS group_key,
        ARRAY_AGG(id ORDER BY created_at)  AS siblings
      FROM story_messages
      WHERE story_chat_id = ${storyChatId}
      GROUP BY COALESCE(parent_id, -1)
    )
    SELECT
      p.id, p.parent_id, p.role, p.kind, p.content, p.created_at,
      s.sibling_count, s.sibling_index, sa.siblings
    FROM path p
    JOIN sibling_info s   ON s.id        = p.id
    JOIN sibling_arrays sa ON sa.group_key = COALESCE(p.parent_id, -1)
    ORDER BY p.created_at ASC
  `);
  logger.debug(
    { durationMs: Date.now() - t0, storyChatId, messageId, pathLen: (rows as unknown[]).length },
    "Story active path queried",
  );
  return rows as Record<string, unknown>[];
}

/** Последний лист дерева (самый свежий узел без детей). Нужен для самовосстановления курсора. */
export async function findLastStoryLeaf(storyChatId: number): Promise<number | null> {
  const t0 = Date.now();
  const leafRows = await db.execute(sql`
    SELECT id FROM story_messages
    WHERE story_chat_id = ${storyChatId}
      AND id NOT IN (
        SELECT DISTINCT parent_id FROM story_messages
        WHERE parent_id IS NOT NULL AND story_chat_id = ${storyChatId}
      )
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const leafId = (leafRows as unknown as { id: unknown }[])[0]?.id;
  logger.debug({ durationMs: Date.now() - t0, storyChatId, leafId: leafId ?? null }, "Last story leaf resolved");
  return leafId != null ? Number(leafId) : null;
}

/** Спускается к листу дерева, следуя самому свежему ребёнку (для переключения ветки). */
export async function findStoryLeaf(storyChatId: number, messageId: number): Promise<number> {
  let current = messageId;
  for (;;) {
    const children = await db
      .select({ id: schema.storyMessages.id })
      .from(schema.storyMessages)
      .where(
        and(
          eq(schema.storyMessages.parentId, current),
          eq(schema.storyMessages.storyChatId, storyChatId),
        ),
      )
      .orderBy(desc(schema.storyMessages.createdAt))
      .limit(1);
    if (children.length === 0) return current;
    current = children[0]!.id;
  }
}
