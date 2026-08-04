import { eq } from "drizzle-orm";
import logger from "../logger.js";
import { clampSearchRounds, DEFAULT_SEARCH_ROUNDS } from "../tavily/searchSettings.js";
import { decryptField, encryptField, getUserEncryptionKey } from "../utils/crypto.js";
import { db, schema } from "./index.js";

/** DAO таблицы user_settings — персональный ключ Tavily (веб-поиск, BYOK, см. tavily/tavilyUsage.ts). */

export interface UserTavilySettingsStatus {
  hasKey: boolean;
  /** Последние 4 символа ключа — для UI ("ключ сохранён, оканчивается на …ab12"), сам ключ не отдаём. */
  last4: string | null;
  /** Максимум раундов tool-calling подряд за одну генерацию с веб-поиском (см. tavily/searchSettings.ts). */
  maxSearchRounds: number;
}

/** Статус ключа + лимит раундов для UI настроек — без расшифрованного ключа. */
export async function getUserTavilySettings(userId: number): Promise<UserTavilySettingsStatus> {
  const t0 = Date.now();
  const rows = await db
    .select({
      apiKey: schema.userSettings.tavilyApiKey,
      maxSearchRounds: schema.userSettings.tavilyMaxSearchRounds,
    })
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, userId));
  const row = rows[0];
  logger.debug({ durationMs: Date.now() - t0, userId, found: Boolean(row) }, "User Tavily settings read");
  const maxSearchRounds = row ? clampSearchRounds(row.maxSearchRounds) : DEFAULT_SEARCH_ROUNDS;
  if (!row?.apiKey) return { hasKey: false, last4: null, maxSearchRounds };
  const key = decryptField(row.apiKey, getUserEncryptionKey(userId));
  return { hasKey: true, last4: key.slice(-4), maxSearchRounds };
}

/** Расшифрованный ключ — для серверных вызовов GET /usage и веб-поиска. null — ключ не задан. */
export async function getDecryptedTavilyKey(userId: number): Promise<string | null> {
  const rows = await db
    .select({ apiKey: schema.userSettings.tavilyApiKey })
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, userId));
  const row = rows[0];
  if (!row?.apiKey) return null;
  return decryptField(row.apiKey, getUserEncryptionKey(userId));
}

/** Лимит раундов веб-поиска — для цикла tool-calling (webSearchLoop.ts). Нет строки → дефолт. */
export async function getTavilyMaxSearchRounds(userId: number): Promise<number> {
  const rows = await db
    .select({ maxSearchRounds: schema.userSettings.tavilyMaxSearchRounds })
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, userId));
  const row = rows[0];
  return row ? clampSearchRounds(row.maxSearchRounds) : DEFAULT_SEARCH_ROUNDS;
}

export interface UserTavilySettingsPatch {
  /** undefined — не трогать сохранённый ключ; null — удалить; string — задать новый. */
  apiKey?: string | null;
  /** undefined — не трогать лимит раундов; иначе — новое значение (кламп применяется здесь). */
  maxSearchRounds?: number;
}

/** Партиальный upsert: трогает только поле, реально пришедшее в patch. */
export async function upsertUserTavilySettings(
  userId: number,
  patch: UserTavilySettingsPatch,
): Promise<UserTavilySettingsStatus> {
  const t0 = Date.now();
  const setFields: { tavilyApiKey?: string | null; tavilyMaxSearchRounds?: number; updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (patch.apiKey !== undefined) {
    setFields.tavilyApiKey = patch.apiKey === null ? null : encryptField(patch.apiKey, getUserEncryptionKey(userId));
  }
  if (patch.maxSearchRounds !== undefined) {
    setFields.tavilyMaxSearchRounds = clampSearchRounds(patch.maxSearchRounds);
  }

  await db
    .insert(schema.userSettings)
    .values({ userId, ...setFields })
    .onConflictDoUpdate({ target: schema.userSettings.userId, set: setFields });

  logger.info(
    { durationMs: Date.now() - t0, userId, keyChanged: patch.apiKey !== undefined },
    "User Tavily settings saved",
  );
  return getUserTavilySettings(userId);
}
