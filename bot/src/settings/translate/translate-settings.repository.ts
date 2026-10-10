import { Injectable } from "@nestjs/common";
import {
  DEFAULT_PROMPT_TRANSLATE_REASONING_EFFORT,
  type PromptTranslateReasoningEffort,
  type TranslateSettings,
  type TranslateSettingsPatch,
} from "@tg-rp-bot/shared";
import { eq } from "drizzle-orm";
import { DatabaseService } from "../../database/database.service.js";
import { schema } from "../../db/index.js";
import logger from "../../logger.js";

const DEFAULTS: TranslateSettings = {
  engine: "google",
  targetLang: "en",
  promptTemplate: null,
  reasoningEffort: DEFAULT_PROMPT_TRANSLATE_REASONING_EFFORT,
};

/**
 * Колонки user_settings с настройками режима перевода в PromptEditorOverlay (полноэкранный редактор
 * промпт-полей). Отдельная сущность от translationSystemPrompt шаблонов (та фича template-scoped,
 * для Globe-кнопки RP-чата) — не путать и не смешивать.
 */
@Injectable()
export class TranslateSettingsRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Настройки перевода для UI/эндпоинта перевода. Нет строки → дефолты. */
  async get(userId: string): Promise<TranslateSettings> {
    const t0 = Date.now();
    const rows = await this.database.db
      .select({
        engine: schema.userSettings.promptTranslateEngine,
        targetLang: schema.userSettings.promptTranslateTargetLang,
        promptTemplate: schema.userSettings.promptTranslateSystemPrompt,
        reasoningEffort: schema.userSettings.promptTranslateReasoningEffort,
      })
      .from(schema.userSettings)
      .where(eq(schema.userSettings.userId, userId));
    const row = rows[0];
    logger.debug({ durationMs: Date.now() - t0, userId, found: Boolean(row) }, "User translate settings read");
    if (!row) return DEFAULTS;
    // Колонка — свободный text, но пишется только через DTO с IsIn по уровням (PATCH /settings/translate).
    return { ...row, reasoningEffort: row.reasoningEffort as PromptTranslateReasoningEffort };
  }

  /** Партиальный upsert: трогает только поля, реально пришедшие в patch. */
  async upsert(userId: string, patch: TranslateSettingsPatch): Promise<TranslateSettings> {
    const t0 = Date.now();
    const setFields: {
      promptTranslateEngine?: TranslateSettings["engine"];
      promptTranslateTargetLang?: string;
      promptTranslateSystemPrompt?: string | null;
      promptTranslateReasoningEffort?: string;
      updatedAt: Date;
    } = { updatedAt: new Date() };
    if (patch.engine !== undefined) setFields.promptTranslateEngine = patch.engine;
    if (patch.targetLang !== undefined) setFields.promptTranslateTargetLang = patch.targetLang;
    if (patch.promptTemplate !== undefined) setFields.promptTranslateSystemPrompt = patch.promptTemplate;
    if (patch.reasoningEffort !== undefined) setFields.promptTranslateReasoningEffort = patch.reasoningEffort;

    await this.database.db
      .insert(schema.userSettings)
      .values({ userId, ...setFields })
      .onConflictDoUpdate({ target: schema.userSettings.userId, set: setFields });

    const fields = Object.keys(patch).filter((k) => patch[k as keyof TranslateSettingsPatch] !== undefined);
    logger.info({ durationMs: Date.now() - t0, userId, patch: fields }, "User translate settings saved");
    return this.get(userId);
  }
}
