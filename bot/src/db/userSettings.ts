import { eq } from "drizzle-orm";
import {
  clampEdgeMessages,
  clampMaxRequests,
  DEFAULT_DEBUG_SETTINGS,
  type LlmDebugSettings,
} from "../llm/debugSettings.js";
import logger from "../logger.js";
import { db, schema } from "./index.js";

/** Колонки строки настроек → доменный тип (с клампом). */
function rowToSettings(row: {
  enabled: boolean;
  maxRequests: number;
  headMessages: number;
  tailMessages: number;
}): LlmDebugSettings {
  return {
    enabled: row.enabled,
    maxRequests: clampMaxRequests(row.maxRequests),
    headMessages: clampEdgeMessages(row.headMessages),
    tailMessages: clampEdgeMessages(row.tailMessages),
  };
}

/**
 * DAO таблицы user_settings — персистентные per-user настройки (источник истины).
 * In-memory кэш для горячего пути перехвата живёт отдельно в llm/debugCapture.ts.
 */

/** Настройки отладки LLM пользователя; если строки ещё нет — дефолты. */
export async function getLlmDebugSettings(userId: number): Promise<LlmDebugSettings> {
  const t0 = Date.now();
  const rows = await db
    .select({
      enabled: schema.userSettings.llmDebugEnabled,
      maxRequests: schema.userSettings.llmDebugMaxRequests,
      headMessages: schema.userSettings.llmDebugHeadMessages,
      tailMessages: schema.userSettings.llmDebugTailMessages,
    })
    .from(schema.userSettings)
    .where(eq(schema.userSettings.userId, userId));
  const row = rows[0];
  logger.debug({ durationMs: Date.now() - t0, userId, found: Boolean(row) }, "LLM debug settings read");
  if (!row) return { ...DEFAULT_DEBUG_SETTINGS };
  return rowToSettings(row);
}

/**
 * Частичный upsert настроек отладки LLM. Требует существующего users-ряда (ensureUser в роуте).
 * Возвращает итоговые настройки (для синхронизации кэша и ответа клиенту).
 */
export async function upsertLlmDebugSettings(
  userId: number,
  patch: Partial<LlmDebugSettings>,
): Promise<LlmDebugSettings> {
  const t0 = Date.now();
  const current = await getLlmDebugSettings(userId);
  const next: LlmDebugSettings = {
    enabled: patch.enabled ?? current.enabled,
    maxRequests: clampMaxRequests(patch.maxRequests ?? current.maxRequests),
    headMessages: clampEdgeMessages(patch.headMessages ?? current.headMessages),
    tailMessages: clampEdgeMessages(patch.tailMessages ?? current.tailMessages),
  };
  await db
    .insert(schema.userSettings)
    .values({
      userId,
      llmDebugEnabled: next.enabled,
      llmDebugMaxRequests: next.maxRequests,
      llmDebugHeadMessages: next.headMessages,
      llmDebugTailMessages: next.tailMessages,
    })
    .onConflictDoUpdate({
      target: schema.userSettings.userId,
      set: {
        llmDebugEnabled: next.enabled,
        llmDebugMaxRequests: next.maxRequests,
        llmDebugHeadMessages: next.headMessages,
        llmDebugTailMessages: next.tailMessages,
        updatedAt: new Date(),
      },
    });
  logger.info({ durationMs: Date.now() - t0, userId, ...next }, "LLM debug settings saved");
  return next;
}

/** Все строки настроек отладки — для прайма in-memory кэша на старте сервера. */
export async function listAllLlmDebugSettings(): Promise<
  Array<{ userId: number } & LlmDebugSettings>
> {
  const t0 = Date.now();
  const rows = await db
    .select({
      userId: schema.userSettings.userId,
      enabled: schema.userSettings.llmDebugEnabled,
      maxRequests: schema.userSettings.llmDebugMaxRequests,
      headMessages: schema.userSettings.llmDebugHeadMessages,
      tailMessages: schema.userSettings.llmDebugTailMessages,
    })
    .from(schema.userSettings);
  logger.debug({ durationMs: Date.now() - t0, count: rows.length }, "LLM debug settings listed");
  return rows.map((r) => ({ userId: r.userId, ...rowToSettings(r) }));
}
