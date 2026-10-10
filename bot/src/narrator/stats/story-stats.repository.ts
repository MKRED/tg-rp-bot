import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DatabaseService } from "../../database/database.service.js";
import { schema } from "../../db/index.js";
import logger from "../../logger.js";
import { countTokens, decryptField } from "../../utils/index.js";
import { StoryPathRepository } from "../story-path.repository.js";
import { UserKeysService } from "../../user-keys/user-keys.service.js";

/** Оценка объёма истории в токенах: вся история (все ветки) и текущая активная ветка. */
export type StoryTokenStats = { tokensTotal: number; tokensActiveBranch: number };

/** Токены сообщений истории для экрана настроек. */
@Injectable()
export class StoryStatsRepository {
  constructor(
    private readonly database: DatabaseService,
    private readonly path: StoryPathRepository,
    private readonly keys: UserKeysService,
  ) {}

  /**
   * Токены всех сообщений и активной ветки. content зашифрован per-user, поэтому считать длину в SQL
   * нельзя (длина шифротекста ≠ длине текста) — расшифровываем. Только сообщения, без промптов.
   * История уже проверена вызывающим (передан её курсор).
   */
  async tokenStats(userId: string, storyId: number, activeMessageId: number | null): Promise<StoryTokenStats> {
    const t0 = Date.now();
    const activePathIds = activeMessageId ? await this.path.activePathIds(activeMessageId) : new Set<number>();
    const rows = await this.database.db
      .select({ id: schema.storyMessages.id, content: schema.storyMessages.content })
      .from(schema.storyMessages)
      .where(eq(schema.storyMessages.storyChatId, storyId));

    const key = await this.keys.forUser(userId);
    let tokensTotal = 0;
    let tokensActiveBranch = 0;
    for (const r of rows) {
      const tokens = countTokens(decryptField(r.content, key));
      tokensTotal += tokens;
      if (activePathIds.has(r.id)) tokensActiveBranch += tokens;
    }
    logger.debug({ durationMs: Date.now() - t0, userId, storyId, tokensTotal, tokensActiveBranch }, "Story token stats computed");
    return { tokensTotal, tokensActiveBranch };
  }
}
