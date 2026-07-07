import { eq, sql } from "drizzle-orm";
import logger from "../../logger.js";
import { encryptField, getUserEncryptionKey } from "../../utils/index.js";
import { db, schema } from "../index.js";
import type { Message } from "../schema.js";
import { decryptMessageRow } from "./crypto.js";
import { findLeaf } from "./queries.js";

/**
 * Вставляет новое сообщение и возвращает его. content шифруется per-user при записи,
 * но возвращается расшифрованным (результат уходит клиенту по SSE).
 */
export async function insertMessage(
  userId: number,
  chatId: number,
  parentId: number | null,
  role: "user" | "assistant",
  content: string,
): Promise<Message> {
  const key = getUserEncryptionKey(userId);
  const rows = await db
    .insert(schema.messages)
    .values({ chatId, parentId, role, content: encryptField(content, key) })
    .returning();
  return decryptMessageRow(rows[0]!, userId);
}

/**
 * Читает одно сообщение по id (без проверки владельца — используется внутри сервера,
 * где chatId уже прошёл авторизацию). content/translations расшифровываются per-user.
 */
export async function getMessage(
  userId: number,
  messageId: number,
): Promise<Message | undefined> {
  const rows = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.id, messageId));
  return rows[0] ? decryptMessageRow(rows[0], userId) : undefined;
}

/**
 * Устанавливает activeMessageId чата на указанный messageId, предварительно
 * опускаясь до листа: если у messageId есть дети — рекурсивно следуем самому
 * свежему ребёнку пока не найдём узел без детей.
 */
export async function updateActiveMessage(chatId: number, messageId: number): Promise<void> {
  const leaf = await findLeaf(chatId, messageId);
  await db
    .update(schema.chats)
    .set({ activeMessageId: leaf })
    .where(eq(schema.chats.id, chatId));
}

/**
 * Ставит курсор ровно на указанный узел (или null), БЕЗ спуска к листу (в отличие от
 * updateActiveMessage). Нужно там, где путь не должен «съезжать» к концу ветки:
 *  — выбор узла в графе (клик по узлу в середине дерева фиксирует диалог на нём);
 *  — построение контекста для регенерации/правки (курсор ставится ВЫШЕ user-реплики,
 *    чтобы getChat вернул историю без старого ответа и без дубля самой реплики).
 */
export async function setActiveMessage(chatId: number, messageId: number | null): Promise<void> {
  await db
    .update(schema.chats)
    .set({ activeMessageId: messageId })
    .where(eq(schema.chats.id, chatId));
}

/**
 * Удаляет сообщение и всё его поддерево (рекурсивно).
 * Если activeMessageId указывал на удаляемый узел/потомка — переключает на родителя
 * (или null, если удалялся корень).
 */
export async function deleteMessage(
  userId: number,
  chatId: number,
  messageId: number,
): Promise<boolean> {
  const t0 = Date.now();

  const msg = await getMessage(userId, messageId);
  if (!msg || msg.chatId !== chatId) return false;

  const chatRows = await db
    .select({ activeMessageId: schema.chats.activeMessageId })
    .from(schema.chats)
    .where(eq(schema.chats.id, chatId));
  const chat = chatRows[0];
  if (!chat) return false;

  // Собираем все ID удаляемого поддерева
  const descendantRows = await db.execute(sql`
    WITH RECURSIVE descendants AS (
      SELECT id FROM messages WHERE id = ${messageId} AND chat_id = ${chatId}
      UNION ALL
      SELECT m.id FROM messages m JOIN descendants d ON m.parent_id = d.id WHERE m.chat_id = ${chatId}
    )
    SELECT id FROM descendants
  `);
  // Number() нужен: db.execute() возвращает bigint-столбцы как BigInt (или строку),
  // а Drizzle ORM через .select() — как number. Без каста Set.has() всегда false.
  const descendantIds = new Set(
    (descendantRows as unknown as { id: unknown }[]).map((r) => Number(r.id)),
  );
  const needsActiveUpdate = chat.activeMessageId != null && descendantIds.has(chat.activeMessageId);

  // Обнуляем курсор заранее, чтобы не было висящего FK при удалении
  if (needsActiveUpdate) {
    await db.update(schema.chats).set({ activeMessageId: null }).where(eq(schema.chats.id, chatId));
  }

  // Удаляем поддерево одним запросом
  await db.execute(sql`
    WITH RECURSIVE descendants AS (
      SELECT id FROM messages WHERE id = ${messageId} AND chat_id = ${chatId}
      UNION ALL
      SELECT m.id FROM messages m JOIN descendants d ON m.parent_id = d.id WHERE m.chat_id = ${chatId}
    )
    DELETE FROM messages WHERE id IN (SELECT id FROM descendants)
  `);

  // Переключаем на родителя (findLeaf найдёт лист среди оставшихся потомков)
  if (needsActiveUpdate && msg.parentId != null) {
    await updateActiveMessage(chatId, msg.parentId);
  }

  logger.info(
    { durationMs: Date.now() - t0, chatId, messageId, deletedCount: descendantIds.size },
    "Message and descendants deleted",
  );
  return true;
}

/**
 * Кэширует перевод сообщения: сливает новую запись в jsonb-объект translations.
 * Значение шифруется per-user; ключ (код языка) остаётся открытым.
 */
export async function saveTranslation(
  userId: number,
  messageId: number,
  lang: string,
  text: string,
): Promise<void> {
  const key = getUserEncryptionKey(userId);
  const encrypted = encryptField(text, key);
  await db.execute(sql`
    UPDATE messages
    SET translations = COALESCE(translations, '{}'::jsonb) || jsonb_build_object(${lang}::text, ${encrypted}::text)
    WHERE id = ${messageId}
  `);
}

/** Убирает закэшированный перевод для одного языка (остальные языки не трогает). */
export async function deleteTranslation(messageId: number, lang: string): Promise<void> {
  await db.execute(sql`
    UPDATE messages
    SET translations = translations - ${lang}::text
    WHERE id = ${messageId}
  `);
}
