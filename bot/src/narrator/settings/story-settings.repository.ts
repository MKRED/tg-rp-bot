import { Injectable } from "@nestjs/common";
import type { StorySettings } from "@tg-rp-bot/shared";
import { eq } from "drizzle-orm";
import { DatabaseService } from "../../database/database.service.js";
import { schema } from "../../db/index.js";
import logger from "../../logger.js";

/** Настройки, если строки story_settings ещё нет (совпадают с дефолтами колонок в схеме). */
const DEFAULT_SETTINGS: StorySettings = {
  translateEnabled: false,
  translateTargetLang: "ru",
  translateScope: "assistant",
  autoTranslateScope: "none",
  translateMethod: "google",
  compactEnabled: false,
  compactAutoEnabled: false,
  compactFloorTokens: 0,
  compactWords: 200,
  quickRollbackEnabled: false,
  editEnabled: false,
};

/** Настройки истории (story_settings, строка на историю): перевод + сжатие. Принадлежность — в сервисе. */
@Injectable()
export class StorySettingsRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Настройки истории; строки нет — дефолт. */
  async get(storyId: number): Promise<StorySettings> {
    const rows = await this.database.db.select().from(schema.storySettings).where(eq(schema.storySettings.storyChatId, storyId));
    const r = rows[0];
    if (!r) return { ...DEFAULT_SETTINGS };
    return {
      translateEnabled: r.translateEnabled,
      translateTargetLang: r.translateTargetLang,
      translateScope: r.translateScope,
      autoTranslateScope: r.autoTranslateScope,
      translateMethod: r.translateMethod,
      compactEnabled: r.compactEnabled,
      compactAutoEnabled: r.compactAutoEnabled,
      compactFloorTokens: r.compactFloorTokens,
      compactWords: r.compactWords,
      quickRollbackEnabled: r.quickRollbackEnabled,
      editEnabled: r.editEnabled,
    };
  }

  /** Создаёт или обновляет настройки (upsert); patch не должен быть пустым (пустой SET — невалидный SQL). */
  async upsert(storyId: number, patch: Partial<StorySettings>): Promise<StorySettings> {
    const t0 = Date.now();
    await this.database.db
      .insert(schema.storySettings)
      .values({ storyChatId: storyId, ...patch })
      .onConflictDoUpdate({ target: schema.storySettings.storyChatId, set: patch });
    logger.info({ durationMs: Date.now() - t0, storyId, fields: Object.keys(patch) }, "Story settings updated");
    return this.get(storyId);
  }
}
