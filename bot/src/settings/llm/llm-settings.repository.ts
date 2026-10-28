import { Injectable } from "@nestjs/common";
import type { LlmSettingsPatch, LlmSettingsStatus } from "@tg-rp-bot/shared";
import { eq } from "drizzle-orm";
import { DatabaseService } from "../../database/database.service.js";
import { schema } from "../../db/index.js";
import logger from "../../logger.js";
import { decryptField, encryptField } from "../../utils/crypto.js";
import { UserKeysService } from "../../user-keys/user-keys.service.js";

/** Колонка user_settings с персональным ключом DeepSeek (BYOK, см. llm/llm.service.ts). */
@Injectable()
export class LlmSettingsRepository {
  constructor(
    private readonly database: DatabaseService,
    private readonly keys: UserKeysService,
  ) {}

  /** Статус ключа для UI настроек — без расшифрованного ключа. */
  async getStatus(userId: string): Promise<LlmSettingsStatus> {
    const t0 = Date.now();
    const row = await this.findRow(userId);
    logger.debug({ durationMs: Date.now() - t0, userId, found: Boolean(row) }, "User LLM settings read");
    if (!row?.apiKey) return { hasKey: false, last4: null };
    const key = decryptField(row.apiKey, await this.keys.forUser(userId));
    return { hasKey: true, last4: key.slice(-4) };
  }

  /**
   * Расшифрованный ключ — для LlmService (один запрос на вызов LLM) и реверификации уже
   * сохранённого ключа (verify без apiKey в теле). null — ключ не задан.
   */
  async getDecryptedApiKey(userId: string): Promise<string | null> {
    const row = await this.findRow(userId);
    if (!row?.apiKey) return null;
    return decryptField(row.apiKey, await this.keys.forUser(userId));
  }

  /** Сохраняет или удаляет ключ (patch.apiKey: undefined — ничего не менять). */
  async upsert(userId: string, patch: LlmSettingsPatch): Promise<LlmSettingsStatus> {
    const t0 = Date.now();
    const setFields: { deepseekApiKey?: string | null; updatedAt: Date } = { updatedAt: new Date() };
    if (patch.apiKey !== undefined) {
      setFields.deepseekApiKey =
        patch.apiKey === null ? null : encryptField(patch.apiKey, await this.keys.forUser(userId));
    }

    await this.database.db
      .insert(schema.userSettings)
      .values({ userId, ...setFields })
      .onConflictDoUpdate({ target: schema.userSettings.userId, set: setFields });

    logger.info(
      { durationMs: Date.now() - t0, userId, keyChanged: patch.apiKey !== undefined },
      "User LLM settings saved",
    );
    return this.getStatus(userId);
  }

  private async findRow(userId: string) {
    const rows = await this.database.db
      .select({ apiKey: schema.userSettings.deepseekApiKey })
      .from(schema.userSettings)
      .where(eq(schema.userSettings.userId, userId));
    return rows[0];
  }
}
