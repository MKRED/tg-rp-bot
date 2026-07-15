import { and, eq, sql } from "drizzle-orm";
import logger from "../../logger.js";
import { decryptField, encryptField, getUserEncryptionKey } from "../../utils/index.js";
import { db, schema } from "../index.js";
import type { Chat } from "../schema.js";
import { decryptTranslations } from "./crypto.js";
import { findLastLeaf, queryActivePath, queryActivePathIds } from "./queries.js";
import type { ChatDetail, ChatInput, ChatListItem, MessageInPath, TreeNode } from "./types.js";

/** Маппит сырую строку пути (из queryActivePath) в MessageInPath, расшифровывая content/translations. */
function mapPathRow(r: Record<string, unknown>, key: Buffer): MessageInPath {
  return {
    id: Number(r.id),
    parentId: r.parent_id != null ? Number(r.parent_id) : null,
    role: r.role as "user" | "assistant",
    content: decryptField(r.content as string, key),
    translations: decryptTranslations(
      (r.translations as Record<string, string> | null) ?? null,
      key,
    ),
    createdAt: String(r.created_at),
    siblingIndex: r.sibling_index as number,
    siblingCount: r.sibling_count as number,
    siblings: (r.siblings as unknown[]).map(Number),
  };
}

// ─── Список чатов ──────────────────────────────────────────────────────────────

/** Пагинированный список чатов пользователя (свежие сверху). */
export async function listChats(
  userId: number,
  page: number,
  pageSize: number,
): Promise<{ items: ChatListItem[]; total: number }> {
  const t0 = Date.now();
  const offset = (page - 1) * pageSize;

  const rows = await db.execute(sql`
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

  const countRows = await db
    .select({ cnt: sql<number>`count(*)::int` })
    .from(schema.chats)
    .where(eq(schema.chats.userId, userId));

  const total = countRows[0]?.cnt ?? 0;
  const key = getUserEncryptionKey(userId);

  const items: ChatListItem[] = (rows as Record<string, unknown>[]).map((r) => ({
    // bigint из сырого SQL приходит строкой — все id приводим к number явно.
    id: Number(r.id),
    // title зашифрован per-user — расшифровываем; null остаётся null (fallback на имя персонажа в UI)
    title: r.title ? decryptField(r.title as string, key) : null,
    character: {
      id: Number(r.char_id),
      name: r.char_name as string,
      hasImage: r.char_has_image as boolean,
    },
    persona: r.persona_id
      ? { id: Number(r.persona_id), name: r.persona_name as string }
      : null,
    // content сообщений зашифрован per-user — расшифровываем последнее для превью списка
    lastMessage: r.last_message ? decryptField(r.last_message as string, key) : null,
    lastMessageAt: r.last_message_at ? String(r.last_message_at) : null,
    messageCount: r.message_count as number,
    createdAt: String(r.created_at),
  }));

  logger.debug({ durationMs: Date.now() - t0, userId, page, total }, "Chats listed");
  return { items, total };
}

// ─── Детальное чтение чата (активный путь) ────────────────────────────────────

/**
 * Читает чат + активный путь (рекурсивный CTE снизу вверх от activeMessageId).
 * Для каждого сообщения пути вычисляет sibling_count, sibling_index, siblings[].
 */
export async function getChat(
  userId: number,
  chatId: number,
): Promise<ChatDetail | undefined> {
  const t0 = Date.now();

  // Проверяем принадлежность и читаем мета
  const chatRows = await db.execute(sql`
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

  const chatRow = (chatRows as Record<string, unknown>[])[0];
  if (!chatRow) return undefined;

  // content/translations сообщений зашифрованы per-user — расшифровываем при маппинге пути
  const key = getUserEncryptionKey(userId);
  // Сырой db.execute (postgres.js) отдаёт bigint строкой — приводим к number, иначе на клиенте
  // строгое сравнение activeMessageId === message.id (id'ы сообщений уже number) ломается.
  let activeMessageId =
    chatRow.active_message_id != null ? Number(chatRow.active_message_id) : null;
  let messages: MessageInPath[] = [];

  if (activeMessageId) {
    let pathRows = await queryActivePath(chatId, activeMessageId);

    // Если путь пуст — active_message_id указывает на удалённое сообщение (повреждённое состояние).
    // Самовосстановление: найти последний лист дерева, переключить курсор на него и повторить запрос.
    if (pathRows.length === 0) {
      const leafId = await findLastLeaf(chatId);
      if (leafId) {
        await db
          .update(schema.chats)
          .set({ activeMessageId: leafId })
          .where(eq(schema.chats.id, chatId));
        activeMessageId = leafId;
        pathRows = await queryActivePath(chatId, leafId);
      }
      // Если leafId нет — чат пуст, messages остаётся []
    }

    messages = pathRows.map((r) => mapPathRow(r, key));
  }

  logger.debug(
    { durationMs: Date.now() - t0, userId, chatId, messageCount: messages.length },
    "Chat loaded",
  );

  return {
    // bigint из сырого SQL приходит строкой — все id приводим к number явно.
    id: Number(chatRow.id),
    // title зашифрован per-user — расшифровываем (ключ key уже получен выше)
    title: chatRow.title ? decryptField(chatRow.title as string, key) : null,
    character: {
      id: Number(chatRow.char_id),
      name: chatRow.char_name as string,
      hasImage: chatRow.char_has_image as boolean,
    },
    persona: chatRow.persona_id
      ? {
          id: Number(chatRow.persona_id),
          name: chatRow.persona_name as string,
          hasImage: chatRow.persona_has_image as boolean,
        }
      : null,
    template: chatRow.template_id
      ? { id: Number(chatRow.template_id), name: chatRow.template_name as string }
      : null,
    preset: chatRow.preset_id
      ? { id: Number(chatRow.preset_id), name: chatRow.preset_name as string }
      : null,
    activeMessageId,
    messages,
  };
}

// ─── Дерево для графа ──────────────────────────────────────────────────────────

/** Все сообщения чата плоским массивом с флагом isOnActivePath (для страницы графа). */
export async function getChatTree(userId: number, chatId: number): Promise<TreeNode[]> {
  const t0 = Date.now();

  // Проверяем принадлежность
  const chatRows = await db
    .select({ id: schema.chats.id, activeMessageId: schema.chats.activeMessageId })
    .from(schema.chats)
    .where(and(eq(schema.chats.id, chatId), eq(schema.chats.userId, userId)));
  const chat = chatRows[0];
  if (!chat) return [];

  const activePath = chat.activeMessageId
    ? await queryActivePathIds(chat.activeMessageId)
    : new Set<number>();

  const allRows = await db
    .select({
      id: schema.messages.id,
      parentId: schema.messages.parentId,
      role: schema.messages.role,
      content: schema.messages.content,
      createdAt: schema.messages.createdAt,
    })
    .from(schema.messages)
    .where(eq(schema.messages.chatId, chatId))
    .orderBy(schema.messages.createdAt);

  logger.debug(
    { durationMs: Date.now() - t0, userId, chatId, count: allRows.length },
    "Chat tree loaded",
  );

  // content зашифрован per-user — расшифровываем для узлов графа
  const key = getUserEncryptionKey(userId);
  return allRows.map((r) => ({
    id: r.id,
    parentId: r.parentId,
    role: r.role as "user" | "assistant",
    content: decryptField(r.content, key),
    isOnActivePath: activePath.has(r.id),
    createdAt: r.createdAt.toISOString(),
  }));
}

// ─── Создание / удаление чата ──────────────────────────────────────────────────

/**
 * Создаёт чат и вставляет стартовое сообщение (firstMessage), если оно не null.
 * Конкретное приветствие выбирает вызывающая сторона; текст уже расшифрован.
 */
export async function createChat(
  userId: number,
  input: ChatInput,
  firstMessage: string | null,
): Promise<Chat> {
  const t0 = Date.now();

  const chatRows = await db
    .insert(schema.chats)
    .values({
      userId,
      characterId: input.characterId,
      personaId: input.personaId,
      templateId: input.templateId,
      presetId: input.presetId,
    })
    .returning();
  const chat = chatRows[0]!;

  if (firstMessage) {
    // content шифруется per-user; firstMessage уже расшифрован вызывающей стороной
    const key = getUserEncryptionKey(userId);
    const msgRows = await db
      .insert(schema.messages)
      .values({
        chatId: chat.id,
        parentId: null,
        role: "assistant",
        content: encryptField(firstMessage, key),
      })
      .returning();
    const msg = msgRows[0]!;
    await db
      .update(schema.chats)
      .set({ activeMessageId: msg.id })
      .where(eq(schema.chats.id, chat.id));
    chat.activeMessageId = msg.id;
  }

  logger.info({ durationMs: Date.now() - t0, userId, chatId: chat.id }, "Chat created");
  return chat;
}

/**
 * Переименовывает чат (только свой). Пустая/пробельная строка → title = null
 * (UI вернётся к показу имени персонажа). Непустой title шифруется per-user.
 * Возвращает применённый title (расшифрованный) или undefined, если чат не найден.
 */
export async function renameChat(
  userId: number,
  chatId: number,
  rawTitle: string,
): Promise<{ title: string | null } | undefined> {
  const t0 = Date.now();
  const trimmed = rawTitle.trim();
  const title = trimmed.length > 0 ? trimmed : null;
  const key = getUserEncryptionKey(userId);

  const rows = await db
    .update(schema.chats)
    .set({ title: title != null ? encryptField(title, key) : null })
    .where(and(eq(schema.chats.id, chatId), eq(schema.chats.userId, userId)))
    .returning({ id: schema.chats.id });

  if (rows.length === 0) {
    logger.info({ durationMs: Date.now() - t0, userId, chatId }, "Chat rename: not found");
    return undefined;
  }

  logger.info(
    { durationMs: Date.now() - t0, userId, chatId, cleared: title === null },
    "Chat renamed",
  );
  return { title };
}

/** Удаляет чат (только свой). true — если строка была удалена. */
export async function deleteChat(userId: number, chatId: number): Promise<boolean> {
  const t0 = Date.now();
  const rows = await db
    .delete(schema.chats)
    .where(and(eq(schema.chats.id, chatId), eq(schema.chats.userId, userId)))
    .returning({ id: schema.chats.id });
  const deleted = rows.length > 0;
  logger.info({ durationMs: Date.now() - t0, userId, chatId, deleted }, "Chat delete attempted");
  return deleted;
}
