import { eq } from "drizzle-orm";
import logger from "../logger.js";
import { db, schema } from "./index.js";

/**
 * DAO таблицы user_settings — настройки режима перевода в PromptEditorOverlay (полноэкранный
 * редактор промпт-полей). Отдельная сущность от rpTemplates/narratorTemplates.translationSystemPrompt
 * (та фича template-scoped, для Globe-кнопки RP-чата) — не путать и не смешивать.
 */

export interface UserTranslateSettings {
  engine: "google" | "ai";
  targetLang: string;
  /** null — свой промпт не задан, вызывающий код подставляет DEFAULT_TRANSLATION_TEMPLATE. */
  promptTemplate: string | null;
  reasoningEffort: string;
}

const DEFAULTS: UserTranslateSettings = {
  engine: "google",
  targetLang: "en",
  promptTemplate: null,
  reasoningEffort: "off",
};

/** Настройки перевода для UI/эндпоинта перевода. Нет строки → дефолты. */
export async function getUserTranslateSettings(userId: number): Promise<UserTranslateSettings> {
  const t0 = Date.now();
  const rows = await db
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
  return {
    engine: row.engine,
    targetLang: row.targetLang,
    promptTemplate: row.promptTemplate,
    reasoningEffort: row.reasoningEffort,
  };
}

export interface UserTranslateSettingsPatch {
  engine?: "google" | "ai";
  targetLang?: string;
  /** undefined — не трогать; null — очистить (вернуться к дефолтному промпту); string — задать свой. */
  promptTemplate?: string | null;
  reasoningEffort?: string;
}

/** Партиальный upsert: трогает только поле, реально пришедшее в patch. */
export async function upsertUserTranslateSettings(
  userId: number,
  patch: UserTranslateSettingsPatch,
): Promise<UserTranslateSettings> {
  const t0 = Date.now();
  const setFields: {
    promptTranslateEngine?: "google" | "ai";
    promptTranslateTargetLang?: string;
    promptTranslateSystemPrompt?: string | null;
    promptTranslateReasoningEffort?: string;
    updatedAt: Date;
  } = { updatedAt: new Date() };
  if (patch.engine !== undefined) setFields.promptTranslateEngine = patch.engine;
  if (patch.targetLang !== undefined) setFields.promptTranslateTargetLang = patch.targetLang;
  if (patch.promptTemplate !== undefined) setFields.promptTranslateSystemPrompt = patch.promptTemplate;
  if (patch.reasoningEffort !== undefined) setFields.promptTranslateReasoningEffort = patch.reasoningEffort;

  await db
    .insert(schema.userSettings)
    .values({ userId, ...setFields })
    .onConflictDoUpdate({ target: schema.userSettings.userId, set: setFields });

  logger.info({ durationMs: Date.now() - t0, userId, patch: Object.keys(patch) }, "User translate settings saved");
  return getUserTranslateSettings(userId);
}
