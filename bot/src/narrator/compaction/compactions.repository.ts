import { Injectable } from "@nestjs/common";
import { and, asc, eq, gte, inArray, or, sql } from "drizzle-orm";
import { DatabaseService } from "../../database/database.service.js";
import { schema } from "../../db/index.js";
import logger from "../../logger.js";
import { decryptField, encryptField, getUserEncryptionKey } from "../../utils/index.js";
import type { CompactionAnchors } from "./compacted-ids.js";

/** Пересказ сжатого диапазона (summary расшифрован). Якоря — внутренние, в webapp не уходят. */
export type CompactionRow = CompactionAnchors & {
  id: number;
  seq: number;
  summary: string;
  coveredCount: number;
  coveredTokens: number;
  createdAt: string;
};

export type NewCompaction = Omit<CompactionRow, "id" | "createdAt">;

function mapRow(row: typeof schema.storyCompactions.$inferSelect, key: Buffer): CompactionRow {
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

/**
 * Пересказы истории (story_compactions) — цепочка по seq; summary зашифрован per-user.
 * Принадлежность истории проверяет вызывающий сервис.
 */
@Injectable()
export class CompactionsRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Все пересказы истории по порядку seq. */
  async list(userId: number, storyId: number): Promise<CompactionRow[]> {
    const key = getUserEncryptionKey(userId);
    const rows = await this.database.db
      .select()
      .from(schema.storyCompactions)
      .where(eq(schema.storyCompactions.storyChatId, storyId))
      .orderBy(asc(schema.storyCompactions.seq));
    return rows.map((r) => mapRow(r, key));
  }

  /** Якоря пересказов без расшифровки summary — для подсветки сжатых сообщений на графе. */
  anchors(storyId: number): Promise<CompactionAnchors[]> {
    return this.database.db
      .select({ fromAnchorId: schema.storyCompactions.fromAnchorId, toAnchorId: schema.storyCompactions.toAnchorId })
      .from(schema.storyCompactions)
      .where(eq(schema.storyCompactions.storyChatId, storyId));
  }

  /** Следующий seq истории (max(seq)+1; пусто — 0). */
  async nextSeq(storyId: number): Promise<number> {
    const rows = await this.database.db
      .select({ maxSeq: sql<number | null>`max(${schema.storyCompactions.seq})` })
      .from(schema.storyCompactions)
      .where(eq(schema.storyCompactions.storyChatId, storyId));
    const maxSeq = rows[0]?.maxSeq;
    return maxSeq == null ? 0 : maxSeq + 1;
  }

  /** Вставляет пересказ (summary шифруется per-user). */
  async insert(userId: number, storyId: number, input: NewCompaction): Promise<CompactionRow> {
    const t0 = Date.now();
    const key = getUserEncryptionKey(userId);
    const [row] = await this.database.db
      .insert(schema.storyCompactions)
      .values({ storyChatId: storyId, ...input, summary: encryptField(input.summary, key) })
      .returning();
    logger.info({ durationMs: Date.now() - t0, userId, storyId, seq: input.seq, toAnchorId: input.toAnchorId }, "Story compaction inserted");
    return mapRow(row!, key);
  }

  /**
   * Удаляет пересказ и все последующие в цепочке (seq ≥ его): префикс остаётся непрерывным, а
   * сообщения удалённых пересказов возвращаются в живую историю. false — пересказа нет в истории.
   */
  async removeCascade(storyId: number, compactionId: number): Promise<boolean> {
    const t0 = Date.now();
    const rows = await this.database.db
      .select({ seq: schema.storyCompactions.seq })
      .from(schema.storyCompactions)
      .where(and(eq(schema.storyCompactions.id, compactionId), eq(schema.storyCompactions.storyChatId, storyId)));
    const seq = rows[0]?.seq;
    if (seq == null) return false;
    const deleted = await this.removeFromSeq(storyId, seq);
    logger.info({ durationMs: Date.now() - t0, storyId, fromSeq: seq, deletedCount: deleted }, "Story compactions deleted (cascade)");
    return true;
  }

  /**
   * Инвалидация при удалении сообщений: якорь (from/to) пересказа попал в удалённые id — удаляем его
   * и все последующие (seq ≥ минимального затронутого), чтобы цепочка не повисла над удалённым.
   *
   * MVP-упрощение: seq глобален по истории, поэтому каскад может задеть пересказ соседней ветки. Это
   * самовосстанавливается (ветка пересожмётся при нужде); точную инвалидацию по поддереву не строим.
   */
  async invalidateByRemovedIds(storyId: number, removedIds: Set<number>): Promise<void> {
    if (removedIds.size === 0) return;
    const t0 = Date.now();
    const ids = [...removedIds];
    const affected = await this.database.db
      .select({ seq: schema.storyCompactions.seq })
      .from(schema.storyCompactions)
      .where(
        and(
          eq(schema.storyCompactions.storyChatId, storyId),
          or(inArray(schema.storyCompactions.fromAnchorId, ids), inArray(schema.storyCompactions.toAnchorId, ids)),
        ),
      )
      .orderBy(asc(schema.storyCompactions.seq))
      .limit(1);
    const minSeq = affected[0]?.seq;
    if (minSeq == null) return;
    const deleted = await this.removeFromSeq(storyId, minSeq);
    logger.info({ durationMs: Date.now() - t0, storyId, fromSeq: minSeq, deletedCount: deleted }, "Story compactions invalidated by message deletion");
  }

  private async removeFromSeq(storyId: number, seq: number): Promise<number> {
    const deleted = await this.database.db
      .delete(schema.storyCompactions)
      .where(and(eq(schema.storyCompactions.storyChatId, storyId), gte(schema.storyCompactions.seq, seq)))
      .returning({ id: schema.storyCompactions.id });
    return deleted.length;
  }
}
