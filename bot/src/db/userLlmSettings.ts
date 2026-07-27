import { eq } from "drizzle-orm";
import logger from "../logger.js";
import { decryptField, encryptField, getUserEncryptionKey } from "../utils/crypto.js";
import { db, schema } from "./index.js";

/** DAO таблицы user_settings — персональный ключ и модель DeepSeek (BYOK, см. llm/resolveProvider.ts). */

export interface UserLlmSettingsStatus {
  hasKey: boolean;
  /** Последние 4 символа ключа — для UI ("ключ сохранён, оканчивается на …ab12"), сам ключ не отдаём. */
  last4: string | null;
  model: string | null;
}

/** Статус ключа/модели для UI настроек — без расшифрованного ключа. */
export async function getUserLlmSettings(userId: number): Promise<UserLlmSettingsStatus> {
  const t0 = Date.now();
  const rows = await db
    .select({
      apiKey: schema.userSettings.deepseekApiKey,
      model: schema.userSettings.deepseekModel,
    })
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, userId));
  const row = rows[0];
  logger.debug({ durationMs: Date.now() - t0, userId, found: Boolean(row) }, "User LLM settings read");
  if (!row?.apiKey) return { hasKey: false, last4: null, model: row?.model ?? null };
  const key = decryptField(row.apiKey, getUserEncryptionKey(userId));
  return { hasKey: true, last4: key.slice(-4), model: row.model };
}

/**
 * Расшифрованный ключ + модель — для resolveProvider (один запрос на вызов LLM) и реверификации
 * уже сохранённого ключа (POST /settings/llm/verify без apiKey в теле). null — ключ не задан.
 */
export async function getDecryptedDeepSeekCredentials(
  userId: number,
): Promise<{ apiKey: string; model: string | null } | null> {
  const rows = await db
    .select({ apiKey: schema.userSettings.deepseekApiKey, model: schema.userSettings.deepseekModel })
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, userId));
  const row = rows[0];
  if (!row?.apiKey) return null;
  return { apiKey: decryptField(row.apiKey, getUserEncryptionKey(userId)), model: row.model };
}

export interface UserLlmSettingsPatch {
  /** undefined — не трогать сохранённый ключ; null — удалить (снести ключ и модель); string — задать новый. */
  apiKey?: string | null;
  model?: string;
}

/**
 * Партиальный upsert: трогает только поля, реально пришедшие в patch (в отличие от
 * db/userSettings.ts, где debug-настройки перезаписываются целиком — там это оправдано клампом,
 * здесь клампа нет, и полная перезапись случайно затёрла бы ключ при смене одной модели).
 */
export async function upsertUserLlmSettings(
  userId: number,
  patch: UserLlmSettingsPatch,
): Promise<UserLlmSettingsStatus> {
  const t0 = Date.now();
  const setFields: { deepseekApiKey?: string | null; deepseekModel?: string | null; updatedAt: Date } = {
    updatedAt: new Date(),
  };
  // Порядок важен: patch.model применяем ДО ветки удаления ключа, иначе комбинация
  // { apiKey: null, model: "..." } (в принципе достижимая через PATCH-тело) оставила бы модель
  // сохранённой без ключа, хотя удаление ключа обязано сносить и её.
  if (patch.model !== undefined) setFields.deepseekModel = patch.model;
  if (patch.apiKey !== undefined) {
    if (patch.apiKey === null) {
      // Удаление ключа сносит и выбранную модель — иначе она осталась бы висеть без ключа,
      // и resolveProvider ошибся бы о причине сбоя (нет ключа, а не модели).
      setFields.deepseekApiKey = null;
      setFields.deepseekModel = null;
    } else {
      setFields.deepseekApiKey = encryptField(patch.apiKey, getUserEncryptionKey(userId));
    }
  }

  await db
    .insert(schema.userSettings)
    .values({ userId, ...setFields })
    .onConflictDoUpdate({ target: schema.userSettings.userId, set: setFields });

  logger.info(
    { durationMs: Date.now() - t0, userId, keyChanged: patch.apiKey !== undefined, model: patch.model },
    "User LLM settings saved",
  );
  return getUserLlmSettings(userId);
}
