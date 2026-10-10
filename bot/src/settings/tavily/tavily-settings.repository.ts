import { Injectable } from "@nestjs/common";
import { DEFAULT_SEARCH_ROUNDS, type TavilySettingsPatch, type TavilySettingsStatus } from "@tg-rp-bot/shared";
import { eq } from "drizzle-orm";
import { DatabaseService } from "../../database/database.service.js";
import { schema } from "../../db/index.js";
import logger from "../../logger.js";
import { clampSearchRounds } from "../../tavily/searchSettings.js";
import { decryptField, encryptField } from "../../utils/crypto.js";
import { UserKeysService } from "../../user-keys/user-keys.service.js";

/** Колонки user_settings с персональным ключом Tavily (веб-поиск, BYOK) и лимитом раундов поиска. */
@Injectable()
export class TavilySettingsRepository {
  constructor(
    private readonly database: DatabaseService,
    private readonly keys: UserKeysService,
  ) {}

  /** Статус ключа + лимит раундов для UI настроек — без расшифрованного ключа. */
  async getStatus(userId: string): Promise<TavilySettingsStatus> {
    const t0 = Date.now();
    const row = await this.findRow(userId);
    logger.debug({ durationMs: Date.now() - t0, userId, found: Boolean(row) }, "User Tavily settings read");
    const maxSearchRounds = row ? clampSearchRounds(row.maxSearchRounds) : DEFAULT_SEARCH_ROUNDS;
    if (!row?.apiKey) return { hasKey: false, last4: null, maxSearchRounds };
    const key = decryptField(row.apiKey, await this.keys.forUser(userId));
    return { hasKey: true, last4: key.slice(-4), maxSearchRounds };
  }

  /** Расшифрованный ключ — для GET /usage и веб-поиска. null — ключ не задан. */
  async getDecryptedKey(userId: string): Promise<string | null> {
    const row = await this.findRow(userId);
    if (!row?.apiKey) return null;
    return decryptField(row.apiKey, await this.keys.forUser(userId));
  }

  /** Лимит раундов веб-поиска — для цикла tool-calling генерации. Нет строки → дефолт. */
  async getMaxSearchRounds(userId: string): Promise<number> {
    const row = await this.findRow(userId);
    return row ? clampSearchRounds(row.maxSearchRounds) : DEFAULT_SEARCH_ROUNDS;
  }

  /** Партиальный upsert: трогает только поля, реально пришедшие в patch; лимит раундов клампится здесь. */
  async upsert(userId: string, patch: TavilySettingsPatch): Promise<TavilySettingsStatus> {
    const t0 = Date.now();
    const setFields: { tavilyApiKey?: string | null; tavilyMaxSearchRounds?: number; updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if (patch.apiKey !== undefined) {
      setFields.tavilyApiKey = patch.apiKey === null ? null : encryptField(patch.apiKey, await this.keys.forUser(userId));
    }
    if (patch.maxSearchRounds !== undefined) {
      setFields.tavilyMaxSearchRounds = clampSearchRounds(patch.maxSearchRounds);
    }

    await this.database.db
      .insert(schema.userSettings)
      .values({ userId, ...setFields })
      .onConflictDoUpdate({ target: schema.userSettings.userId, set: setFields });

    logger.info(
      { durationMs: Date.now() - t0, userId, keyChanged: patch.apiKey !== undefined },
      "User Tavily settings saved",
    );
    return this.getStatus(userId);
  }

  private async findRow(userId: string) {
    const rows = await this.database.db
      .select({
        apiKey: schema.userSettings.tavilyApiKey,
        maxSearchRounds: schema.userSettings.tavilyMaxSearchRounds,
      })
      .from(schema.userSettings)
      .where(eq(schema.userSettings.userId, userId));
    return rows[0];
  }
}
