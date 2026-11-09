import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DatabaseService } from "../database/database.service.js";
import { schema } from "../db/index.js";
import logger from "../logger.js";

/** Хеш токена агента ComfyUI в user_settings. */
@Injectable()
export class ComfyAgentRepository {
  constructor(private readonly database: DatabaseService) {}

  async hasToken(userId: string): Promise<boolean> {
    const t0 = Date.now();
    const rows = await this.database.db
      .select({ hash: schema.userSettings.comfyAgentTokenHash })
      .from(schema.userSettings)
      .where(eq(schema.userSettings.userId, userId))
      .limit(1);
    logger.debug({ durationMs: Date.now() - t0, userId }, "Comfy agent token status read");
    return Boolean(rows[0]?.hash);
  }

  /** Пользователь по хешу токена — так входит агент. null — токен неизвестен или отозван. */
  async findUserIdByTokenHash(hash: string): Promise<string | null> {
    const t0 = Date.now();
    const rows = await this.database.db
      .select({ userId: schema.userSettings.userId })
      .from(schema.userSettings)
      .where(eq(schema.userSettings.comfyAgentTokenHash, hash))
      .limit(1);
    logger.debug({ durationMs: Date.now() - t0, found: rows.length > 0 }, "Comfy agent token looked up");
    return rows[0]?.userId ?? null;
  }

  /** Сохраняет хеш нового токена (null — отзыв). Старый токен перестаёт работать сразу. */
  async setTokenHash(userId: string, hash: string | null): Promise<void> {
    const t0 = Date.now();
    const set = { comfyAgentTokenHash: hash, updatedAt: new Date() };
    await this.database.db
      .insert(schema.userSettings)
      .values({ userId, ...set })
      .onConflictDoUpdate({ target: schema.userSettings.userId, set });
    logger.info({ durationMs: Date.now() - t0, userId, revoked: hash === null }, "Comfy agent token saved");
  }
}
