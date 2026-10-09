import { Injectable } from "@nestjs/common";
import type { LlmDebugSettings, LlmDebugSettingsPatch } from "@tg-rp-bot/shared";
import { eq } from "drizzle-orm";
import { DatabaseService } from "../database/database.service.js";
import { schema } from "../db/index.js";
import { clampEdgeMessages, clampMaxRequests, DEFAULT_DEBUG_SETTINGS } from "../llm/debugSettings.js";
import logger from "../logger.js";

/** Колонки настроек отладки в select (функция, а не константа: схема не трогается при импорте модуля). */
const debugColumns = () => ({
  enabled: schema.userSettings.llmDebugEnabled,
  maxRequests: schema.userSettings.llmDebugMaxRequests,
  headMessages: schema.userSettings.llmDebugHeadMessages,
  tailMessages: schema.userSettings.llmDebugTailMessages,
});

/** Кламп прочитанных из БД настроек — колонки могли быть записаны до смены диапазонов. */
function clampSettings(row: LlmDebugSettings): LlmDebugSettings {
  return {
    enabled: row.enabled,
    maxRequests: clampMaxRequests(row.maxRequests),
    headMessages: clampEdgeMessages(row.headMessages),
    tailMessages: clampEdgeMessages(row.tailMessages),
  };
}

/**
 * Колонки user_settings с настройками отладочного перехвата LLM — источник истины. In-memory кэш
 * для горячего пути перехвата живёт отдельно, в llm/debugCapture.ts.
 */
@Injectable()
export class DebugRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Настройки пользователя; если строки ещё нет — дефолты. */
  async getSettings(userId: number): Promise<LlmDebugSettings> {
    const t0 = Date.now();
    const rows = await this.database.db
      .select(debugColumns())
      .from(schema.userSettings)
      .where(eq(schema.userSettings.userId, userId));
    const row = rows[0];
    logger.debug({ durationMs: Date.now() - t0, userId, found: Boolean(row) }, "LLM debug settings read");
    return row ? clampSettings(row) : { ...DEFAULT_DEBUG_SETTINGS };
  }

  /**
   * Частичный upsert: недостающие поля берутся из текущих настроек, итог клампится и пишется
   * целиком (все четыре колонки). Возвращает итоговые настройки — для кэша и ответа клиенту.
   */
  async upsertSettings(userId: number, patch: LlmDebugSettingsPatch): Promise<LlmDebugSettings> {
    const t0 = Date.now();
    const current = await this.getSettings(userId);
    const next: LlmDebugSettings = {
      enabled: patch.enabled ?? current.enabled,
      maxRequests: clampMaxRequests(patch.maxRequests ?? current.maxRequests),
      headMessages: clampEdgeMessages(patch.headMessages ?? current.headMessages),
      tailMessages: clampEdgeMessages(patch.tailMessages ?? current.tailMessages),
    };
    const columns = {
      llmDebugEnabled: next.enabled,
      llmDebugMaxRequests: next.maxRequests,
      llmDebugHeadMessages: next.headMessages,
      llmDebugTailMessages: next.tailMessages,
    };
    await this.database.db
      .insert(schema.userSettings)
      .values({ userId, ...columns })
      .onConflictDoUpdate({ target: schema.userSettings.userId, set: { ...columns, updatedAt: new Date() } });
    logger.info({ durationMs: Date.now() - t0, userId, ...next }, "LLM debug settings saved");
    return next;
  }

  /** Настройки всех пользователей — для прайма in-memory кэша на старте сервера. */
  async listAllSettings(): Promise<Array<{ userId: number } & LlmDebugSettings>> {
    const t0 = Date.now();
    const rows = await this.database.db
      .select({ userId: schema.userSettings.userId, ...debugColumns() })
      .from(schema.userSettings);
    logger.debug({ durationMs: Date.now() - t0, count: rows.length }, "LLM debug settings listed");
    return rows.map(({ userId, ...settings }) => ({ userId, ...clampSettings(settings) }));
  }
}
