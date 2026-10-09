import { Injectable } from "@nestjs/common";
import type { MessageRole } from "@tg-rp-bot/shared";
import { eq, sql } from "drizzle-orm";
import { DatabaseService } from "../../database/database.service.js";
import { schema } from "../../db/index.js";
import type { Message } from "../../db/schema.js";
import logger from "../../logger.js";
import { encryptField, getUserEncryptionKey } from "../../utils/index.js";
import { ChatPathRepository } from "../chat-path.repository.js";
import { decryptMessageRow } from "../message-crypto.js";

/**
 * Сообщения дерева чата и курсор активной ветки (chats.active_message_id). content и значения
 * translations зашифрованы per-user. Принадлежность чата проверяет вызывающий сервис.
 */
@Injectable()
export class MessagesRepository {
  constructor(
    private readonly database: DatabaseService,
    private readonly path: ChatPathRepository,
  ) {}

  /** Вставляет сообщение; content шифруется при записи, но возвращается расшифрованным (уходит клиенту). */
  async insert(userId: number, chatId: number, parentId: number | null, role: MessageRole, content: string): Promise<Message> {
    const key = getUserEncryptionKey(userId);
    const [row] = await this.database.db
      .insert(schema.messages)
      .values({ chatId, parentId, role, content: encryptField(content, key) })
      .returning();
    return decryptMessageRow(row!, userId);
  }

  /**
   * Одно сообщение по id, расшифрованное. Без проверки владельца — вызывающий сравнивает
   * message.chatId с уже проверенным чатом.
   */
  async findOne(userId: number, messageId: number): Promise<Message | undefined> {
    const rows = await this.database.db.select().from(schema.messages).where(eq(schema.messages.id, messageId));
    return rows[0] ? decryptMessageRow(rows[0], userId) : undefined;
  }

  /** Курсор — на лист под messageId (спуск по самым свежим детям): продолжение ветки сохраняется. */
  async moveCursorToLeaf(chatId: number, messageId: number): Promise<void> {
    const leaf = await this.path.leafBelow(chatId, messageId);
    await this.database.db.update(schema.chats).set({ activeMessageId: leaf }).where(eq(schema.chats.id, chatId));
  }

  /**
   * Курсор ровно на узел (или null), БЕЗ спуска к листу. Нужно там, где путь не должен «съезжать»
   * к концу ветки: выбор узла в графе и построение контекста регенерации/правки (курсор ставится
   * ВЫШЕ user-реплики, чтобы история пришла без старого ответа и без дубля самой реплики).
   */
  async setCursor(chatId: number, messageId: number | null): Promise<void> {
    await this.database.db.update(schema.chats).set({ activeMessageId: messageId }).where(eq(schema.chats.id, chatId));
  }

  /**
   * Удаляет сообщение и всё его поддерево. Если курсор был внутри поддерева — переносит его на
   * родителя (со спуском к оставшемуся листу) или в null, если удалялся корень.
   */
  async removeSubtree(userId: number, chatId: number, messageId: number): Promise<boolean> {
    const t0 = Date.now();
    const msg = await this.findOne(userId, messageId);
    if (!msg || msg.chatId !== chatId) return false;

    const chatRows = await this.database.db
      .select({ activeMessageId: schema.chats.activeMessageId })
      .from(schema.chats)
      .where(eq(schema.chats.id, chatId));
    const chat = chatRows[0];
    if (!chat) return false;

    const descendantRows = await this.database.db.execute(sql`
      WITH RECURSIVE descendants AS (
        SELECT id FROM messages WHERE id = ${messageId} AND chat_id = ${chatId}
        UNION ALL
        SELECT m.id FROM messages m JOIN descendants d ON m.parent_id = d.id WHERE m.chat_id = ${chatId}
      )
      SELECT id FROM descendants
    `);
    // bigint из сырого SQL — строкой; без Number() Set.has(number) всегда false.
    const descendantIds = new Set((descendantRows as unknown as { id: unknown }[]).map((r) => Number(r.id)));
    const needsCursorUpdate = chat.activeMessageId != null && descendantIds.has(chat.activeMessageId);

    // Курсор снимаем до удаления (FK на active_message_id нет): он не должен указывать на удалённое.
    if (needsCursorUpdate) await this.setCursor(chatId, null);

    await this.database.db.execute(sql`
      WITH RECURSIVE descendants AS (
        SELECT id FROM messages WHERE id = ${messageId} AND chat_id = ${chatId}
        UNION ALL
        SELECT m.id FROM messages m JOIN descendants d ON m.parent_id = d.id WHERE m.chat_id = ${chatId}
      )
      DELETE FROM messages WHERE id IN (SELECT id FROM descendants)
    `);

    if (needsCursorUpdate && msg.parentId != null) await this.moveCursorToLeaf(chatId, msg.parentId);

    logger.info(
      { durationMs: Date.now() - t0, chatId, messageId, deletedCount: descendantIds.size },
      "Message and descendants deleted",
    );
    return true;
  }

  /** Кэширует перевод: сливает запись в jsonb translations. Значение шифруется, код языка — открыт. */
  async saveTranslation(userId: number, messageId: number, lang: string, text: string): Promise<void> {
    const encrypted = encryptField(text, getUserEncryptionKey(userId));
    await this.database.db.execute(sql`
      UPDATE messages
      SET translations = COALESCE(translations, '{}'::jsonb) || jsonb_build_object(${lang}::text, ${encrypted}::text)
      WHERE id = ${messageId}
    `);
  }

  /** Убирает закэшированный перевод для одного языка (остальные языки не трогает). */
  async deleteTranslation(messageId: number, lang: string): Promise<void> {
    await this.database.db.execute(sql`
      UPDATE messages
      SET translations = translations - ${lang}::text
      WHERE id = ${messageId}
    `);
  }
}
