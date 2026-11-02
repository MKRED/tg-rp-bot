import { Injectable } from "@nestjs/common";
import { DEFAULT_SEARCH_ROUNDS, type WebSearchSettings, type WebSearchSettingsPatch } from "@tg-rp-bot/shared";
import { eq } from "drizzle-orm";
import { DatabaseService } from "../../database/database.service.js";
import { schema } from "../../db/index.js";
import logger from "../../logger.js";
import { clampSearchRounds } from "../../web-search/searchSettings.js";

/**
 * Колонка user_settings с лимитом раундов веб-поиска. Ключа здесь нет: поиск идёт через ключ
 * DeepSeek пользователя (LlmSettingsRepository).
 */
@Injectable()
export class WebSearchSettingsRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Лимит раундов — для UI настроек и цикла tool-calling генерации. Нет строки → дефолт. */
  async get(userId: string): Promise<WebSearchSettings> {
    const t0 = Date.now();
    const rows = await this.database.db
      .select({ maxSearchRounds: schema.userSettings.webSearchMaxRounds })
      .from(schema.userSettings)
      .where(eq(schema.userSettings.userId, userId));
    logger.debug({ durationMs: Date.now() - t0, userId, found: rows.length > 0 }, "User web search settings read");
    return { maxSearchRounds: rows[0] ? clampSearchRounds(rows[0].maxSearchRounds) : DEFAULT_SEARCH_ROUNDS };
  }

  /** Партиальный upsert; лимит раундов клампится здесь. */
  async upsert(userId: string, patch: WebSearchSettingsPatch): Promise<WebSearchSettings> {
    const t0 = Date.now();
    const setFields: { webSearchMaxRounds?: number; updatedAt: Date } = { updatedAt: new Date() };
    if (patch.maxSearchRounds !== undefined) {
      setFields.webSearchMaxRounds = clampSearchRounds(patch.maxSearchRounds);
    }

    await this.database.db
      .insert(schema.userSettings)
      .values({ userId, ...setFields })
      .onConflictDoUpdate({ target: schema.userSettings.userId, set: setFields });

    logger.info({ durationMs: Date.now() - t0, userId }, "User web search settings saved");
    return this.get(userId);
  }
}
