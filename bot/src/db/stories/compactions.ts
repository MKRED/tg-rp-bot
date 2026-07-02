import { and, asc, eq, gte, inArray, or, sql } from "drizzle-orm";
import logger from "../../logger.js";
import { decryptField, encryptField, getUserEncryptionKey } from "../../utils/index.js";
import { db, schema } from "../index.js";
import type { StoryCompactionRow } from "./types.js";

/** Сырая строка → расшифрованный StoryCompactionRow. */
function mapRow(row: typeof schema.storyCompactions.$inferSelect, key: Buffer): StoryCompactionRow {
  return {
    id: row.id,
    seq: row.seq,
    fromAnchorId: row.fromAnchorId,
    toAnchorId: row.toAnchorId,
    summary: decryptField(row.summary, key),
    coveredCount: row.coveredCount,
    coveredTokens: row.coveredTokens,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Все пересказы истории по порядку seq (summary расшифрован). */
export async function listCompactions(
  userId: number,
  storyChatId: number,
): Promise<StoryCompactionRow[]> {
  const key = getUserEncryptionKey(userId);
  const rows = await db
    .select()
    .from(schema.storyCompactions)
    .where(eq(schema.storyCompactions.storyChatId, storyChatId))
    .orderBy(asc(schema.storyCompactions.seq));
  return rows.map((r) => mapRow(r, key));
}

/**
 * Якоря пересказов без расшифровки summary — для подсветки сжатых сообщений на графе, где
 * сам текст пересказа не нужен.
 */
export async function listCompactionAnchors(
  storyChatId: number,
): Promise<{ fromAnchorId: number | null; toAnchorId: number }[]> {
  return db
    .select({
      fromAnchorId: schema.storyCompactions.fromAnchorId,
      toAnchorId: schema.storyCompactions.toAnchorId,
    })
    .from(schema.storyCompactions)
    .where(eq(schema.storyCompactions.storyChatId, storyChatId));
}

/** Следующий seq для истории (длина цепочки = max(seq)+1). */
export async function nextCompactionSeq(storyChatId: number): Promise<number> {
  const rows = await db
    .select({ maxSeq: sql<number | null>`max(${schema.storyCompactions.seq})` })
    .from(schema.storyCompactions)
    .where(eq(schema.storyCompactions.storyChatId, storyChatId));
  const maxSeq = rows[0]?.maxSeq;
  return maxSeq == null ? 0 : maxSeq + 1;
}

/** Вставляет пересказ (summary шифруется per-user). */
export async function insertCompaction(
  userId: number,
  storyChatId: number,
  input: {
    seq: number;
    fromAnchorId: number | null;
    toAnchorId: number;
    summary: string;
    coveredCount: number;
    coveredTokens: number;
  },
): Promise<StoryCompactionRow> {
  const t0 = Date.now();
  const key = getUserEncryptionKey(userId);
  const rows = await db
    .insert(schema.storyCompactions)
    .values({
      storyChatId,
      seq: input.seq,
      fromAnchorId: input.fromAnchorId,
      toAnchorId: input.toAnchorId,
      summary: encryptField(input.summary, key),
      coveredCount: input.coveredCount,
      coveredTokens: input.coveredTokens,
    })
    .returning();
  logger.info(
    { durationMs: Date.now() - t0, userId, storyChatId, seq: input.seq, toAnchorId: input.toAnchorId },
    "Story compaction inserted",
  );
  return mapRow(rows[0]!, key);
}

/**
 * Удаляет пересказ и все последующие в цепочке (seq ≥ его). Так префикс остаётся непрерывным,
 * а сообщения удалённых пересказов возвращаются в живую историю. false — если пересказ не найден.
 */
export async function deleteCompactionCascade(
  storyChatId: number,
  compactionId: number,
): Promise<boolean> {
  const t0 = Date.now();
  const rows = await db
    .select({ seq: schema.storyCompactions.seq })
    .from(schema.storyCompactions)
    .where(
      and(
        eq(schema.storyCompactions.id, compactionId),
        eq(schema.storyCompactions.storyChatId, storyChatId),
      ),
    );
  const seq = rows[0]?.seq;
  if (seq == null) return false;
  const deleted = await db
    .delete(schema.storyCompactions)
    .where(
      and(eq(schema.storyCompactions.storyChatId, storyChatId), gte(schema.storyCompactions.seq, seq)),
    )
    .returning({ id: schema.storyCompactions.id });
  logger.info(
    { durationMs: Date.now() - t0, storyChatId, fromSeq: seq, deletedCount: deleted.length },
    "Story compactions deleted (cascade)",
  );
  return true;
}

/**
 * Инвалидция при удалении сообщений: если якорь (from/to) какого-то пересказа попал в удалённые id —
 * удаляем этот пересказ и все последующие (seq ≥ минимального затронутого), чтобы цепочка-префикс
 * не повисла над удалённым контентом.
 *
 * MVP-упрощение: seq глобален по истории, поэтому каскад `seq ≥ minSeq` может задеть пересказ
 * соседней ветки (они переплетены по seq). Это самовосстанавливается (ветка пересожмётся при нужде —
 * в рамках инварианта «пересжать если нужно»); точную инвалидцию по поддереву не строим.
 */
export async function invalidateCompactionsByRemovedIds(
  storyChatId: number,
  removedIds: Set<number>,
): Promise<void> {
  if (removedIds.size === 0) return;
  const t0 = Date.now();
  const ids = [...removedIds];
  const affected = await db
    .select({ seq: schema.storyCompactions.seq })
    .from(schema.storyCompactions)
    .where(
      and(
        eq(schema.storyCompactions.storyChatId, storyChatId),
        or(
          inArray(schema.storyCompactions.fromAnchorId, ids),
          inArray(schema.storyCompactions.toAnchorId, ids),
        ),
      ),
    )
    .orderBy(asc(schema.storyCompactions.seq))
    .limit(1);
  const minSeq = affected[0]?.seq;
  if (minSeq == null) return;
  const deleted = await db
    .delete(schema.storyCompactions)
    .where(
      and(
        eq(schema.storyCompactions.storyChatId, storyChatId),
        gte(schema.storyCompactions.seq, minSeq),
      ),
    )
    .returning({ id: schema.storyCompactions.id });
  logger.info(
    { durationMs: Date.now() - t0, storyChatId, fromSeq: minSeq, deletedCount: deleted.length },
    "Story compactions invalidated by message deletion",
  );
}
