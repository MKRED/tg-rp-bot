import { eq } from "drizzle-orm";
import { db, schema } from "../index.js";
import type { ChatSettingsRow } from "./types.js";

const DEFAULT_SETTINGS: ChatSettingsRow = {
  translateEnabled: false,
  translateTargetLang: "ru",
  translateScope: "assistant",
  autoTranslateScope: "none",
};

/** Читает настройки чата; если строки нет — возвращает дефолт. */
export async function getChatSettings(chatId: number): Promise<ChatSettingsRow> {
  const rows = await db
    .select()
    .from(schema.chatSettings)
    .where(eq(schema.chatSettings.chatId, chatId));
  if (!rows[0]) return { ...DEFAULT_SETTINGS };
  const r = rows[0];
  return {
    translateEnabled: r.translateEnabled,
    translateTargetLang: r.translateTargetLang,
    translateScope: r.translateScope,
    autoTranslateScope: r.autoTranslateScope,
  };
}

/** Создаёт или обновляет настройки чата (upsert). */
export async function upsertChatSettings(
  chatId: number,
  patch: Partial<ChatSettingsRow>,
): Promise<ChatSettingsRow> {
  await db
    .insert(schema.chatSettings)
    .values({ chatId, ...patch })
    .onConflictDoUpdate({ target: schema.chatSettings.chatId, set: patch });
  return getChatSettings(chatId);
}
