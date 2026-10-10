import { Injectable } from "@nestjs/common";
import { and, eq, gt, lt } from "drizzle-orm";
import { schema } from "../../db/index.js";
import { DatabaseService } from "../../database/database.service.js";
import logger from "../../logger.js";

export interface ActiveSession {
  userId: string;
  lastUsedAt: Date;
}

@Injectable()
export class SessionsRepository {
  constructor(private readonly database: DatabaseService) {}

  async insert(userId: string, tokenHash: string, expiresAt: Date, userAgent: string | null): Promise<void> {
    const t0 = Date.now();
    await this.database.db.insert(schema.userSessions).values({ userId, tokenHash, expiresAt, userAgent });
    logger.info({ durationMs: Date.now() - t0, userId }, "Session created");
  }

  /** Непросроченная сессия по хэшу токена. */
  async findActive(tokenHash: string): Promise<ActiveSession | undefined> {
    const t0 = Date.now();
    const [row] = await this.database.db
      .select({ userId: schema.userSessions.userId, lastUsedAt: schema.userSessions.lastUsedAt })
      .from(schema.userSessions)
      .where(and(eq(schema.userSessions.tokenHash, tokenHash), gt(schema.userSessions.expiresAt, new Date())));
    logger.debug({ durationMs: Date.now() - t0, found: Boolean(row) }, "Session looked up");
    return row;
  }

  async extend(tokenHash: string, expiresAt: Date): Promise<void> {
    const t0 = Date.now();
    await this.database.db
      .update(schema.userSessions)
      .set({ expiresAt, lastUsedAt: new Date() })
      .where(eq(schema.userSessions.tokenHash, tokenHash));
    logger.debug({ durationMs: Date.now() - t0 }, "Session extended");
  }

  async delete(tokenHash: string): Promise<void> {
    const t0 = Date.now();
    const rows = await this.database.db
      .delete(schema.userSessions)
      .where(eq(schema.userSessions.tokenHash, tokenHash))
      .returning({ id: schema.userSessions.id });
    logger.info({ durationMs: Date.now() - t0, deleted: rows.length }, "Session deleted");
  }

  async deleteExpired(): Promise<number> {
    const t0 = Date.now();
    const rows = await this.database.db
      .delete(schema.userSessions)
      .where(lt(schema.userSessions.expiresAt, new Date()))
      .returning({ id: schema.userSessions.id });
    logger.info({ durationMs: Date.now() - t0, deleted: rows.length }, "Expired sessions purged");
    return rows.length;
  }
}
