import { Injectable } from "@nestjs/common";
import type { LlmSettingsPatch, LlmSettingsStatus } from "@tg-rp-bot/shared";
import { eq } from "drizzle-orm";
import { DatabaseService } from "../../database/database.service.js";
import { schema } from "../../db/index.js";
import logger from "../../logger.js";
import { decryptField, encryptField, getUserEncryptionKey } from "../../utils/crypto.js";

/** Колонки user_settings с персональным ключом и моделью DeepSeek (BYOK, см. llm/resolveProvider.ts). */
@Injectable()
export class LlmSettingsRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Статус ключа/модели для UI настроек — без расшифрованного ключа. */
  async getStatus(userId: number): Promise<LlmSettingsStatus> {
    const t0 = Date.now();
    const row = await this.findRow(userId);
    logger.debug({ durationMs: Date.now() - t0, userId, found: Boolean(row) }, "User LLM settings read");
    if (!row?.apiKey) return { hasKey: false, last4: null, model: row?.model ?? null };
    const key = decryptField(row.apiKey, getUserEncryptionKey(userId));
    return { hasKey: true, last4: key.slice(-4), model: row.model };
  }

  /**
   * Расшифрованный ключ + модель — для resolveProvider (один запрос на вызов LLM) и реверификации
   * уже сохранённого ключа (verify без apiKey в теле). null — ключ не задан.
   */
  async getDecryptedCredentials(userId: number): Promise<{ apiKey: string; model: string | null } | null> {
    const row = await this.findRow(userId);
    if (!row?.apiKey) return null;
    return { apiKey: decryptField(row.apiKey, getUserEncryptionKey(userId)), model: row.model };
  }

  /**
   * Партиальный upsert: трогает только поля, реально пришедшие в patch (в отличие от debug-настроек
   * в debug/debug.repository.ts, которые перезаписываются целиком под клампом) — полная перезапись здесь
   * случайно затёрла бы ключ при смене одной модели.
   */
  async upsert(userId: number, patch: LlmSettingsPatch): Promise<LlmSettingsStatus> {
    const t0 = Date.now();
    const setFields: { deepseekApiKey?: string | null; deepseekModel?: string | null; updatedAt: Date } = {
      updatedAt: new Date(),
    };
    // Порядок важен: model применяем ДО ветки удаления ключа, иначе комбинация { apiKey: null,
    // model: "..." } оставила бы модель сохранённой без ключа, хотя удаление ключа сносит и её.
    if (patch.model !== undefined) setFields.deepseekModel = patch.model;
    if (patch.apiKey !== undefined) {
      if (patch.apiKey === null) {
        // Удаление ключа сносит и выбранную модель — иначе она висела бы без ключа, и resolveProvider
        // ошибся бы о причине сбоя (нет ключа, а не модели).
        setFields.deepseekApiKey = null;
        setFields.deepseekModel = null;
      } else {
        setFields.deepseekApiKey = encryptField(patch.apiKey, getUserEncryptionKey(userId));
      }
    }

    await this.database.db
      .insert(schema.userSettings)
      .values({ userId, ...setFields })
      .onConflictDoUpdate({ target: schema.userSettings.userId, set: setFields });

    logger.info(
      { durationMs: Date.now() - t0, userId, keyChanged: patch.apiKey !== undefined, model: patch.model },
      "User LLM settings saved",
    );
    return this.getStatus(userId);
  }

  private async findRow(userId: number) {
    const rows = await this.database.db
      .select({ apiKey: schema.userSettings.deepseekApiKey, model: schema.userSettings.deepseekModel })
      .from(schema.userSettings)
      .where(eq(schema.userSettings.userId, userId));
    return rows[0];
  }
}
