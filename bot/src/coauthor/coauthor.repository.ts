import { Injectable } from "@nestjs/common";
import type { CoauthorChatInput } from "@tg-rp-bot/shared";
import { and, desc, eq, sql } from "drizzle-orm";
import { schema } from "../db/index.js";
import type { CoauthorChatRow } from "../db/schema.js";
import { DatabaseService } from "../database/database.service.js";
import logger from "../logger.js";
import { UserKeysService } from "../user-keys/user-keys.service.js";
import { decryptField, encryptField } from "../utils/index.js";
import { parseCoauthorState, serializeCoauthorState, type CoauthorState } from "./turn/state.js";

/** Чат соавтора после расшифровки: state разобран. */
export interface CoauthorChatRecord extends Omit<CoauthorChatRow, "state"> {
  state: CoauthorState;
}

export interface CoauthorListRow {
  id: number;
  name: string;
  cardIds: number[];
  updatedAt: Date;
}

/**
 * Доступ к таблице coauthor_chats. Все запросы ограничены владельцем; systemPrompt и state
 * шифруются per-user ключом.
 */
@Injectable()
export class CoauthorRepository {
  constructor(
    private readonly database: DatabaseService,
    private readonly keys: UserKeysService,
  ) {}

  async list(userId: string): Promise<CoauthorListRow[]> {
    const t0 = Date.now();
    const rows = await this.database.db
      .select({
        id: schema.coauthorChats.id,
        name: schema.coauthorChats.name,
        cardIds: schema.coauthorChats.cardIds,
        updatedAt: schema.coauthorChats.updatedAt,
      })
      .from(schema.coauthorChats)
      .where(eq(schema.coauthorChats.userId, userId))
      .orderBy(desc(schema.coauthorChats.updatedAt));
    logger.debug({ durationMs: Date.now() - t0, userId, count: rows.length }, "Coauthor chats listed");
    return rows;
  }

  async count(userId: string): Promise<number> {
    const rows = await this.database.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.coauthorChats)
      .where(eq(schema.coauthorChats.userId, userId));
    return rows[0]?.count ?? 0;
  }

  async findOne(userId: string, id: number): Promise<CoauthorChatRecord | undefined> {
    const t0 = Date.now();
    const rows = await this.database.db
      .select()
      .from(schema.coauthorChats)
      .where(and(eq(schema.coauthorChats.id, id), eq(schema.coauthorChats.userId, userId)));
    const row = rows[0];
    logger.debug({ durationMs: Date.now() - t0, userId, id, found: Boolean(row) }, "Coauthor chat fetched");
    return row ? this.decrypt(row, await this.keys.forUser(userId)) : undefined;
  }

  async create(userId: string, input: CoauthorChatInput): Promise<CoauthorChatRecord> {
    const t0 = Date.now();
    const key = await this.keys.forUser(userId);
    const rows = await this.database.db
      .insert(schema.coauthorChats)
      .values({
        userId,
        name: input.name,
        cardIds: input.cardIds,
        presetId: input.presetId,
        systemPrompt: encryptField(input.systemPrompt.trim(), key),
        useAskUser: input.useAskUser,
        useWebSearch: input.useWebSearch,
      })
      .returning();
    const created = rows[0]!;
    logger.info({ durationMs: Date.now() - t0, userId, id: created.id, cards: input.cardIds.length }, "Coauthor chat created");
    return this.decrypt(created, key);
  }

  /** Записывает настройки и (если передано) состояние. undefined — чата нет. */
  async update(
    userId: string,
    id: number,
    input: CoauthorChatInput,
    state?: CoauthorState,
  ): Promise<CoauthorChatRecord | undefined> {
    const t0 = Date.now();
    const key = await this.keys.forUser(userId);
    const rows = await this.database.db
      .update(schema.coauthorChats)
      .set({
        name: input.name,
        cardIds: input.cardIds,
        presetId: input.presetId,
        systemPrompt: encryptField(input.systemPrompt.trim(), key),
        useAskUser: input.useAskUser,
        useWebSearch: input.useWebSearch,
        ...(state && { state: encryptField(serializeCoauthorState(state), key) }),
      })
      .where(and(eq(schema.coauthorChats.id, id), eq(schema.coauthorChats.userId, userId)))
      .returning();
    const updated = rows[0];
    logger.info({ durationMs: Date.now() - t0, userId, id, found: Boolean(updated) }, "Coauthor chat updated");
    return updated ? this.decrypt(updated, key) : undefined;
  }

  /** Записывает только состояние (переписку, правки) — после хода или решения по правкам. */
  async saveState(userId: string, id: number, state: CoauthorState): Promise<CoauthorChatRecord | undefined> {
    const t0 = Date.now();
    const key = await this.keys.forUser(userId);
    const rows = await this.database.db
      .update(schema.coauthorChats)
      .set({ state: encryptField(serializeCoauthorState(state), key) })
      .where(and(eq(schema.coauthorChats.id, id), eq(schema.coauthorChats.userId, userId)))
      .returning();
    const updated = rows[0];
    logger.info(
      { durationMs: Date.now() - t0, userId, id, found: Boolean(updated), messages: state.messages.length },
      "Coauthor chat state saved",
    );
    return updated ? this.decrypt(updated, key) : undefined;
  }

  async delete(userId: string, id: number): Promise<boolean> {
    const t0 = Date.now();
    const rows = await this.database.db
      .delete(schema.coauthorChats)
      .where(and(eq(schema.coauthorChats.id, id), eq(schema.coauthorChats.userId, userId)))
      .returning({ id: schema.coauthorChats.id });
    logger.info({ durationMs: Date.now() - t0, userId, id, deleted: rows.length > 0 }, "Coauthor chat delete attempted");
    return rows.length > 0;
  }

  private decrypt(row: CoauthorChatRow, key: Buffer): CoauthorChatRecord {
    return {
      ...row,
      systemPrompt: decryptField(row.systemPrompt, key),
      state: parseCoauthorState(decryptField(row.state, key)),
    };
  }
}
