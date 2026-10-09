import { Injectable } from "@nestjs/common";
import type { ChatDetail, ChatListItem, MessageInPath, MessageRole, TreeNode } from "@tg-rp-bot/shared";
import { and, eq, sql } from "drizzle-orm";
import { DatabaseService } from "../../database/database.service.js";
import { schema } from "../../db/index.js";
import type { Chat } from "../../db/schema.js";
import logger from "../../logger.js";
import { decryptField, encryptField, getUserEncryptionKey } from "../../utils/index.js";
import { ChatPathRepository } from "../chat-path.repository.js";
import { decryptTranslations } from "../message-crypto.js";

/** Сущности, выбранные при создании чата (выбранное приветствие передаётся отдельно, уже текстом). */
export type ChatRefs = { characterId: number; personaId: number; templateId: number; presetId: number };

/** Лёгкая строка чата без сообщений: принадлежность, курсор и id связанных сущностей. */
export type ChatRow = Pick<Chat, "id" | "activeMessageId" | "characterId" | "personaId" | "templateId" | "presetId">;

/** Маппит сырую строку пути (ChatPathRepository.activePath) в MessageInPath, расшифровывая поля. */
function mapPathRow(r: Record<string, unknown>, key: Buffer): MessageInPath {
  return {
    id: Number(r.id),
    parentId: r.parent_id != null ? Number(r.parent_id) : null,
    role: r.role as MessageRole,
    content: decryptField(r.content as string, key),
    translations: decryptTranslations((r.translations as Record<string, string> | null) ?? null, key),
    createdAt: String(r.created_at),
    siblingIndex: r.sibling_index as number,
    siblingCount: r.sibling_count as number,
    siblings: (r.siblings as unknown[]).map(Number),
  };
}

/** Чаты пользователя (таблица chats). title и content сообщений зашифрованы per-user. */
@Injectable()
export class ChatsRepository {
  constructor(
    private readonly database: DatabaseService,
    private readonly path: ChatPathRepository,
  ) {}

  /** Пагинированный список чатов пользователя (свежие по последнему сообщению сверху). */
  async list(userId: number, page: number, pageSize: number): Promise<{ items: ChatListItem[]; total: number }> {
    const t0 = Date.now();
    const offset = (page - 1) * pageSize;
    const rows = await this.database.db.execute(sql`
      SELECT
        c.id,
        c.title,
        c.created_at,
        ch.id   AS char_id,
        ch.name AS char_name,
        ch.image IS NOT NULL AS char_has_image,
        p.id    AS persona_id,
        p.name  AS persona_name,
        lm.content AS last_message,
        lm.created_at AS last_message_at,
        COALESCE(mc.cnt, 0) AS message_count
      FROM chats c
      JOIN characters ch ON ch.id = c.character_id
      LEFT JOIN personas  p  ON p.id  = c.persona_id
      LEFT JOIN LATERAL (
        SELECT content, created_at FROM messages
        WHERE chat_id = c.id
        ORDER BY created_at DESC LIMIT 1
      ) lm ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt FROM messages WHERE chat_id = c.id
      ) mc ON TRUE
      WHERE c.user_id = ${userId}
      ORDER BY COALESCE(lm.created_at, c.created_at) DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `);
    const countRows = await this.database.db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(schema.chats)
      .where(eq(schema.chats.userId, userId));
    const total = countRows[0]?.cnt ?? 0;
    const key = getUserEncryptionKey(userId);

    const items: ChatListItem[] = (rows as Record<string, unknown>[]).map((r) => ({
      // bigint из сырого SQL приходит строкой — все id приводим к number явно.
      id: Number(r.id),
      // null остаётся null — UI покажет имя персонажа.
      title: r.title ? decryptField(r.title as string, key) : null,
      character: { id: Number(r.char_id), name: r.char_name as string, hasImage: r.char_has_image as boolean },
      persona: r.persona_id ? { id: Number(r.persona_id), name: r.persona_name as string } : null,
      lastMessage: r.last_message ? decryptField(r.last_message as string, key) : null,
      lastMessageAt: r.last_message_at ? String(r.last_message_at) : null,
      messageCount: r.message_count as number,
      createdAt: String(r.created_at),
    }));
    logger.debug({ durationMs: Date.now() - t0, userId, page, total }, "Chats listed");
    return { items, total };
  }

  /** Строка чата без сообщений, только если он принадлежит пользователю. */
  async findRow(userId: number, chatId: number): Promise<ChatRow | undefined> {
    const c = schema.chats;
    const rows = await this.database.db
      .select({
        id: c.id,
        activeMessageId: c.activeMessageId,
        characterId: c.characterId,
        personaId: c.personaId,
        templateId: c.templateId,
        presetId: c.presetId,
      })
      .from(c)
      .where(and(eq(c.id, chatId), eq(c.userId, userId)));
    return rows[0];
  }

  /** Чат + активный путь с информацией о сиблингах (для экрана чата и сборки промпта). */
  async findDetail(userId: number, chatId: number): Promise<ChatDetail | undefined> {
    const t0 = Date.now();
    const chatRows = await this.database.db.execute(sql`
      SELECT
        c.id,
        c.title,
        c.active_message_id,
        ch.id   AS char_id,
        ch.name AS char_name,
        ch.image IS NOT NULL AS char_has_image,
        p.id    AS persona_id,
        p.name  AS persona_name,
        p.image IS NOT NULL AS persona_has_image,
        rt.id   AS template_id,
        rt.name AS template_name,
        pr.id   AS preset_id,
        pr.name AS preset_name
      FROM chats c
      JOIN characters ch ON ch.id = c.character_id
      LEFT JOIN personas p  ON p.id  = c.persona_id
      LEFT JOIN rp_templates rt ON rt.id = c.template_id
      LEFT JOIN generation_presets pr ON pr.id = c.preset_id
      WHERE c.id = ${chatId} AND c.user_id = ${userId}
      LIMIT 1
    `);
    const row = (chatRows as Record<string, unknown>[])[0];
    if (!row) return undefined;

    const key = getUserEncryptionKey(userId);
    // bigint строкой → number: иначе на клиенте activeMessageId === message.id не совпадёт.
    let activeMessageId = row.active_message_id != null ? Number(row.active_message_id) : null;
    let messages: MessageInPath[] = [];
    if (activeMessageId) {
      let pathRows = await this.path.activePath(chatId, activeMessageId);
      // Пустой путь — курсор указывает на удалённое сообщение (повреждённое состояние).
      // Самовосстановление: переключаем курсор на последний лист и повторяем запрос.
      if (pathRows.length === 0) {
        const leafId = await this.path.lastLeaf(chatId);
        if (leafId) {
          await this.database.db.update(schema.chats).set({ activeMessageId: leafId }).where(eq(schema.chats.id, chatId));
          activeMessageId = leafId;
          pathRows = await this.path.activePath(chatId, leafId);
        }
      }
      messages = pathRows.map((r) => mapPathRow(r, key));
    }
    logger.debug({ durationMs: Date.now() - t0, userId, chatId, messageCount: messages.length }, "Chat loaded");

    return {
      id: Number(row.id),
      title: row.title ? decryptField(row.title as string, key) : null,
      character: { id: Number(row.char_id), name: row.char_name as string, hasImage: row.char_has_image as boolean },
      persona: row.persona_id
        ? { id: Number(row.persona_id), name: row.persona_name as string, hasImage: row.persona_has_image as boolean }
        : null,
      template: row.template_id ? { id: Number(row.template_id), name: row.template_name as string } : null,
      preset: row.preset_id ? { id: Number(row.preset_id), name: row.preset_name as string } : null,
      activeMessageId,
      messages,
    };
  }

  /** Все сообщения чата плоским массивом с флагом isOnActivePath (граф веток). Чат должен быть проверен. */
  async tree(userId: number, chat: ChatRow): Promise<TreeNode[]> {
    const t0 = Date.now();
    const activePath = chat.activeMessageId ? await this.path.activePathIds(chat.activeMessageId) : new Set<number>();
    const m = schema.messages;
    const rows = await this.database.db
      .select({ id: m.id, parentId: m.parentId, role: m.role, content: m.content, createdAt: m.createdAt })
      .from(m)
      .where(eq(m.chatId, chat.id))
      .orderBy(m.createdAt);
    logger.debug({ durationMs: Date.now() - t0, userId, chatId: chat.id, count: rows.length }, "Chat tree loaded");
    const key = getUserEncryptionKey(userId);
    return rows.map((r) => ({
      id: r.id,
      parentId: r.parentId,
      role: r.role,
      content: decryptField(r.content, key),
      isOnActivePath: activePath.has(r.id),
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** Создаёт чат и, если задано, стартовое сообщение ассистента (курсор — на него). */
  async create(userId: number, refs: ChatRefs, firstMessage: string | null): Promise<Chat> {
    const t0 = Date.now();
    const [chat] = await this.database.db
      .insert(schema.chats)
      .values({ userId, ...refs })
      .returning();
    if (firstMessage) {
      const key = getUserEncryptionKey(userId);
      const [msg] = await this.database.db
        .insert(schema.messages)
        .values({ chatId: chat!.id, parentId: null, role: "assistant", content: encryptField(firstMessage, key) })
        .returning();
      await this.database.db.update(schema.chats).set({ activeMessageId: msg!.id }).where(eq(schema.chats.id, chat!.id));
      chat!.activeMessageId = msg!.id;
    }
    logger.info({ durationMs: Date.now() - t0, userId, chatId: chat!.id }, "Chat created");
    return chat!;
  }

  /**
   * Переименовывает чат. Пустая/пробельная строка → title = null (UI вернётся к имени персонажа).
   * Возвращает применённый title или undefined, если чат не найден.
   */
  async rename(userId: number, chatId: number, rawTitle: string): Promise<{ title: string | null } | undefined> {
    const t0 = Date.now();
    const trimmed = rawTitle.trim();
    const title = trimmed.length > 0 ? trimmed : null;
    const key = getUserEncryptionKey(userId);
    const rows = await this.database.db
      .update(schema.chats)
      .set({ title: title != null ? encryptField(title, key) : null })
      .where(and(eq(schema.chats.id, chatId), eq(schema.chats.userId, userId)))
      .returning({ id: schema.chats.id });
    if (rows.length === 0) {
      logger.info({ durationMs: Date.now() - t0, userId, chatId }, "Chat rename: not found");
      return undefined;
    }
    logger.info({ durationMs: Date.now() - t0, userId, chatId, cleared: title === null }, "Chat renamed");
    return { title };
  }

  /** Удаляет чат (сообщения и варианты — каскадом). true — если строка была удалена. */
  async remove(userId: number, chatId: number): Promise<boolean> {
    const t0 = Date.now();
    const rows = await this.database.db
      .delete(schema.chats)
      .where(and(eq(schema.chats.id, chatId), eq(schema.chats.userId, userId)))
      .returning({ id: schema.chats.id });
    const deleted = rows.length > 0;
    logger.info({ durationMs: Date.now() - t0, userId, chatId, deleted }, "Chat delete attempted");
    return deleted;
  }
}
