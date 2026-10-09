import { Injectable } from "@nestjs/common";
import { and, desc, eq, sql } from "drizzle-orm";
import { DatabaseService } from "../database/database.service.js";
import { schema } from "../db/index.js";

/**
 * Обход дерева сообщений истории: активный путь (от курсора к корню), листья, дети. Зеркало
 * rp-chat/chat-path.repository.ts по story_messages (story_chat_id, есть kind).
 */
@Injectable()
export class StoryPathRepository {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Рекурсивный CTE: путь от узла messageId к корню + sibling-информация для каждого узла пути.
   * Возвращает сырые строки — расшифровку content/translations делает вызывающая сторона (нужен ключ).
   */
  async activePath(storyId: number, messageId: number): Promise<Record<string, unknown>[]> {
    const rows = await this.database.db.execute(sql`
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
        FROM story_messages WHERE story_chat_id = ${storyId}
      ),
      sibling_arrays AS (
        SELECT
          COALESCE(parent_id, -1)            AS group_key,
          ARRAY_AGG(id ORDER BY created_at)  AS siblings
        FROM story_messages
        WHERE story_chat_id = ${storyId}
        GROUP BY COALESCE(parent_id, -1)
      )
      SELECT
        p.id, p.parent_id, p.role, p.kind, p.content, p.translations, p.created_at,
        s.sibling_count, s.sibling_index, sa.siblings
      FROM path p
      JOIN sibling_info s   ON s.id        = p.id
      JOIN sibling_arrays sa ON sa.group_key = COALESCE(p.parent_id, -1)
      ORDER BY p.created_at ASC
    `);
    return rows as Record<string, unknown>[];
  }

  /** ID активного пути от узла к корню — для флага isOnActivePath в графе и токенов активной ветки. */
  async activePathIds(activeMessageId: number): Promise<Set<number>> {
    const rows = await this.database.db.execute(sql`
      WITH RECURSIVE path AS (
        SELECT id, parent_id FROM story_messages WHERE id = ${activeMessageId}
        UNION ALL
        SELECT m.id, m.parent_id FROM story_messages m JOIN path p ON m.id = p.parent_id
      )
      SELECT id FROM path
    `);
    // bigint из сырого SQL приходит строкой — без Number() Set.has(number) всегда false.
    return new Set((rows as unknown as { id: unknown }[]).map((r) => Number(r.id)));
  }

  /** Самый свежий лист дерева (узел без детей). Нужен для самовосстановления курсора. */
  async lastLeaf(storyId: number): Promise<number | null> {
    const rows = await this.database.db.execute(sql`
      SELECT id FROM story_messages
      WHERE story_chat_id = ${storyId}
        AND id NOT IN (
          SELECT DISTINCT parent_id FROM story_messages
          WHERE parent_id IS NOT NULL AND story_chat_id = ${storyId}
        )
      ORDER BY created_at DESC
      LIMIT 1
    `);
    const leafId = (rows as unknown as { id: unknown }[])[0]?.id;
    return leafId != null ? Number(leafId) : null;
  }

  /** Самый свежий прямой ребёнок узла (один уровень вниз) или null, если детей нет. */
  async newestChild(storyId: number, messageId: number): Promise<number | null> {
    const children = await this.database.db
      .select({ id: schema.storyMessages.id })
      .from(schema.storyMessages)
      .where(and(eq(schema.storyMessages.parentId, messageId), eq(schema.storyMessages.storyChatId, storyId)))
      .orderBy(desc(schema.storyMessages.createdAt))
      .limit(1);
    return children[0]?.id ?? null;
  }

  /** Спускается от узла к листу, следуя самому свежему ребёнку (продолжение ветки сохраняется). */
  async leafBelow(storyId: number, messageId: number): Promise<number> {
    let current = messageId;
    for (;;) {
      const child = await this.newestChild(storyId, current);
      if (child == null) return current;
      current = child;
    }
  }
}
