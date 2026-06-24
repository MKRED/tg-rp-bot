import { eq, sql } from "drizzle-orm";
import logger from "../../logger.js";
import { decryptField, encryptField, getUserEncryptionKey } from "../../utils/index.js";
import { db, schema } from "../index.js";
import type { StoryMessage } from "../schema.js";
import { findStoryLeaf } from "./queries.js";

/** Расшифровывает content строки сообщения истории. */
function decryptRow(row: StoryMessage, userId: number): StoryMessage {
  const key = getUserEncryptionKey(userId);
  return { ...row, content: decryptField(row.content, key) };
}

/**
 * Вставляет сообщение истории и возвращает его (content расшифрован — результат уходит по SSE).
 * kind: beat (assistant-бит) | continue | directive (эфемерные user-ходы).
 */
export async function insertStoryMessage(
  userId: number,
  storyChatId: number,
  parentId: number | null,
  role: "user" | "assistant",
  kind: "beat" | "continue" | "directive",
  content: string,
): Promise<StoryMessage> {
  const t0 = Date.now();
  const key = getUserEncryptionKey(userId);
  const rows = await db
    .insert(schema.storyMessages)
    .values({ storyChatId, parentId, role, kind, content: encryptField(content, key) })
    .returning();
  logger.debug(
    { durationMs: Date.now() - t0, userId, storyChatId, messageId: rows[0]!.id, role, kind },
    "Story message inserted",
  );
  return decryptRow(rows[0]!, userId);
}

/** Читает одно сообщение по id (без проверки владельца — storyChatId уже прошёл авторизацию выше). */
export async function getStoryMessage(
  userId: number,
  messageId: number,
): Promise<StoryMessage | undefined> {
  const t0 = Date.now();
  const rows = await db
    .select()
    .from(schema.storyMessages)
    .where(eq(schema.storyMessages.id, messageId));
  logger.debug({ durationMs: Date.now() - t0, userId, messageId, found: rows.length > 0 }, "Story message read");
  return rows[0] ? decryptRow(rows[0], userId) : undefined;
}

/** Ставит курсор истории на messageId, опускаясь до листа (как в RP). */
export async function updateActiveStoryMessage(
  storyChatId: number,
  messageId: number,
): Promise<void> {
  const t0 = Date.now();
  const leaf = await findStoryLeaf(storyChatId, messageId);
  await db
    .update(schema.storyChats)
    .set({ activeMessageId: leaf })
    .where(eq(schema.storyChats.id, storyChatId));
  logger.debug({ durationMs: Date.now() - t0, storyChatId, messageId, leaf }, "Story cursor updated to leaf");
}

/** Ставит курсор ровно на узел (или null), БЕЗ спуска к листу (для построения контекста/графа). */
export async function setActiveStoryMessage(
  storyChatId: number,
  messageId: number | null,
): Promise<void> {
  const t0 = Date.now();
  await db
    .update(schema.storyChats)
    .set({ activeMessageId: messageId })
    .where(eq(schema.storyChats.id, storyChatId));
  logger.debug({ durationMs: Date.now() - t0, storyChatId, messageId }, "Story cursor set to node");
}

/**
 * Удаляет сообщение истории и всё поддерево. Если курсор указывал внутрь удаляемого — переключает
 * на родителя (или null для корня). Зеркало db/chats/messages.ts deleteMessage.
 */
export async function deleteStoryMessage(
  userId: number,
  storyChatId: number,
  messageId: number,
): Promise<boolean> {
  const t0 = Date.now();

  const msg = await getStoryMessage(userId, messageId);
  if (!msg || msg.storyChatId !== storyChatId) return false;

  const storyRows = await db
    .select({ activeMessageId: schema.storyChats.activeMessageId })
    .from(schema.storyChats)
    .where(eq(schema.storyChats.id, storyChatId));
  const story = storyRows[0];
  if (!story) return false;

  const descendantRows = await db.execute(sql`
    WITH RECURSIVE descendants AS (
      SELECT id FROM story_messages WHERE id = ${messageId} AND story_chat_id = ${storyChatId}
      UNION ALL
      SELECT m.id FROM story_messages m JOIN descendants d ON m.parent_id = d.id
        WHERE m.story_chat_id = ${storyChatId}
    )
    SELECT id FROM descendants
  `);
  const descendantIds = new Set(
    (descendantRows as unknown as { id: unknown }[]).map((r) => Number(r.id)),
  );
  const needsActiveUpdate =
    story.activeMessageId != null && descendantIds.has(story.activeMessageId);

  if (needsActiveUpdate) {
    await db
      .update(schema.storyChats)
      .set({ activeMessageId: null })
      .where(eq(schema.storyChats.id, storyChatId));
  }

  await db.execute(sql`
    WITH RECURSIVE descendants AS (
      SELECT id FROM story_messages WHERE id = ${messageId} AND story_chat_id = ${storyChatId}
      UNION ALL
      SELECT m.id FROM story_messages m JOIN descendants d ON m.parent_id = d.id
        WHERE m.story_chat_id = ${storyChatId}
    )
    DELETE FROM story_messages WHERE id IN (SELECT id FROM descendants)
  `);

  if (needsActiveUpdate && msg.parentId != null) {
    await updateActiveStoryMessage(storyChatId, msg.parentId);
  }

  logger.info(
    { durationMs: Date.now() - t0, storyChatId, messageId, deletedCount: descendantIds.size },
    "Story message and descendants deleted",
  );
  return true;
}
