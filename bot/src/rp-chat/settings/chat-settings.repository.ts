import { Injectable } from "@nestjs/common";
import type { ChatSettings } from "@tg-rp-bot/shared";
import { eq } from "drizzle-orm";
import { DatabaseService } from "../../database/database.service.js";
import { schema } from "../../db/index.js";
import logger from "../../logger.js";

/** Настройки, если строки chat_settings ещё нет (совпадают с дефолтами колонок в схеме). */
const DEFAULT_SETTINGS: ChatSettings = {
  translateEnabled: false,
  translateTargetLang: "ru",
  translateScope: "assistant",
  autoTranslateScope: "none",
  translateMethod: "google",
};

/** Настройки перевода чата (chat_settings, строка на чат). Принадлежность чата проверяет сервис. */
@Injectable()
export class ChatSettingsRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Настройки чата; строки нет — дефолт. */
  async get(chatId: number): Promise<ChatSettings> {
    const rows = await this.database.db.select().from(schema.chatSettings).where(eq(schema.chatSettings.chatId, chatId));
    const r = rows[0];
    if (!r) return { ...DEFAULT_SETTINGS };
    return {
      translateEnabled: r.translateEnabled,
      translateTargetLang: r.translateTargetLang,
      translateScope: r.translateScope,
      autoTranslateScope: r.autoTranslateScope,
      translateMethod: r.translateMethod,
    };
  }

  /** Создаёт или обновляет настройки (upsert); patch не должен быть пустым. */
  async upsert(chatId: number, patch: Partial<ChatSettings>): Promise<ChatSettings> {
    const t0 = Date.now();
    await this.database.db
      .insert(schema.chatSettings)
      .values({ chatId, ...patch })
      .onConflictDoUpdate({ target: schema.chatSettings.chatId, set: patch });
    logger.info({ durationMs: Date.now() - t0, chatId, fields: Object.keys(patch) }, "Chat settings updated");
    return this.get(chatId);
  }
}
