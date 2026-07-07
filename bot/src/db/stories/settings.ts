import { eq } from "drizzle-orm";
import logger from "../../logger.js";
import { db, schema } from "../index.js";
import type { StorySettingsRow } from "./types.js";

const DEFAULT_SETTINGS: StorySettingsRow = {
  translateEnabled: false,
  translateTargetLang: "ru",
  translateScope: "assistant",
  autoTranslateScope: "none",
  translateMethod: "google",
  compactEnabled: false,
  compactAutoEnabled: false,
  compactFloorTokens: 0,
  compactWords: 200,
};

/** Читает настройки истории; если строки нет — возвращает дефолт. Зеркало getChatSettings. */
export async function getStorySettings(storyChatId: number): Promise<StorySettingsRow> {
  const t0 = Date.now();
  const rows = await db
    .select()
    .from(schema.storySettings)
    .where(eq(schema.storySettings.storyChatId, storyChatId));
  logger.debug(
    { durationMs: Date.now() - t0, storyChatId, found: rows.length > 0 },
    "Story settings read",
  );
  if (!rows[0]) return { ...DEFAULT_SETTINGS };
  const r = rows[0];
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
  };
}

/** Создаёт или обновляет настройки истории (upsert). */
export async function upsertStorySettings(
  storyChatId: number,
  patch: Partial<StorySettingsRow>,
): Promise<StorySettingsRow> {
  const t0 = Date.now();
  await db
    .insert(schema.storySettings)
    .values({ storyChatId, ...patch })
    .onConflictDoUpdate({ target: schema.storySettings.storyChatId, set: patch });
  logger.debug(
    { durationMs: Date.now() - t0, storyChatId, fields: Object.keys(patch) },
    "Story settings upserted",
  );
  return getStorySettings(storyChatId);
}
