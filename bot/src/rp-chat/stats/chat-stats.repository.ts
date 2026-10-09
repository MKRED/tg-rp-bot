import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DatabaseService } from "../../database/database.service.js";
import { schema } from "../../db/index.js";
import logger from "../../logger.js";
import { countTokens, decryptField, getUserEncryptionKey } from "../../utils/index.js";
import { ChatPathRepository } from "../chat-path.repository.js";

/** Оценка объёма чата в токенах: весь чат (все ветки) и текущая активная ветка. */
export type ChatTokenStats = { tokensTotal: number; tokensActiveBranch: number };

/** Токены сообщений чата для экрана настроек. */
@Injectable()
export class ChatStatsRepository {
  constructor(
    private readonly database: DatabaseService,
    private readonly path: ChatPathRepository,
  ) {}

  /**
   * Токены всех сообщений и активной ветки. content зашифрован per-user, поэтому считать длину в SQL
   * нельзя (длина шифротекста ≠ длине текста) — расшифровываем. Только сообщения, без промптов.
   * Чат уже проверен вызывающим (передан его курсор).
   */
  async tokenStats(userId: number, chatId: number, activeMessageId: number | null): Promise<ChatTokenStats> {
    const t0 = Date.now();
    const activePathIds = activeMessageId ? await this.path.activePathIds(activeMessageId) : new Set<number>();
    const rows = await this.database.db
      .select({ id: schema.messages.id, content: schema.messages.content })
      .from(schema.messages)
      .where(eq(schema.messages.chatId, chatId));

    const key = getUserEncryptionKey(userId);
    let tokensTotal = 0;
    let tokensActiveBranch = 0;
    for (const r of rows) {
      const tokens = countTokens(decryptField(r.content, key));
      tokensTotal += tokens;
      if (activePathIds.has(r.id)) tokensActiveBranch += tokens;
    }
    logger.debug({ durationMs: Date.now() - t0, userId, chatId, tokensTotal, tokensActiveBranch }, "Chat token stats computed");
    return { tokensTotal, tokensActiveBranch };
  }
}
