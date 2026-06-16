import { and, eq } from "drizzle-orm";
import logger from "../../logger.js";
import { countTokens, decryptField, getUserEncryptionKey } from "../../utils/index.js";
import { db, schema } from "../index.js";
import { queryActivePathIds } from "./queries.js";
import type { ChatTokenStats } from "./types.js";

/**
 * Считает объём чата в токенах: весь чат (все ветки дерева) и активную ветку отдельно.
 * Content зашифрован per-user — расшифровываем, поэтому считать длину в SQL нельзя
 * (длина шифротекста ≠ длине открытого текста). Активную ветку выделяем по queryActivePathIds.
 * Считаются только токены сообщений, без системных/персонажных промптов.
 */
export async function getChatTokenStats(
  userId: number,
  chatId: number,
): Promise<ChatTokenStats> {
  const t0 = Date.now();

  // Принадлежность + курсор активной ветки одним лёгким запросом.
  const chatRows = await db
    .select({ id: schema.chats.id, activeMessageId: schema.chats.activeMessageId })
    .from(schema.chats)
    .where(and(eq(schema.chats.id, chatId), eq(schema.chats.userId, userId)));
  const chat = chatRows[0];
  if (!chat) return { tokensTotal: 0, tokensActiveBranch: 0 };

  // queryActivePathIds безопасна только для не-null курсора (пустой/новый чат → ветки нет).
  const activePathIds = chat.activeMessageId
    ? await queryActivePathIds(chat.activeMessageId)
    : new Set<number>();

  const rows = await db
    .select({ id: schema.messages.id, content: schema.messages.content })
    .from(schema.messages)
    .where(eq(schema.messages.chatId, chatId));

  const key = getUserEncryptionKey(userId);
  let tokensTotal = 0;
  let tokensActiveBranch = 0;
  for (const r of rows) {
    const tokens = countTokens(decryptField(r.content, key));
    tokensTotal += tokens;
    if (activePathIds.has(r.id)) tokensActiveBranch += tokens;
  }

  logger.debug(
    { durationMs: Date.now() - t0, userId, chatId, tokensTotal, tokensActiveBranch },
    "Chat token stats computed",
  );
  return { tokensTotal, tokensActiveBranch };
}
