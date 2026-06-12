import { and, desc, eq, sql } from "drizzle-orm";
import logger from "../logger.js";
import { decryptField, getUserEncryptionKey } from "../utils/index.js";
import { db, schema } from "./index.js";
import type { Chat, Message } from "./schema.js";

// ─── Публичные типы ────────────────────────────────────────────────────────────

export type ChatInput = {
  characterId: number;
  personaId: number | null;
  presetId: number | null;
};

/**
 * Одно сообщение активного пути с информацией о сиблингах.
 * siblings — упорядоченные ID сиблингов (created_at ASC), нужны стрелкам ← → в UI.
 */
export type MessageInPath = {
  id: number;
  parentId: number | null;
  role: "user" | "assistant";
  content: string;
  translations: Record<string, string> | null;
  createdAt: string;
  siblingIndex: number;
  siblingCount: number;
  siblings: number[];
};

export type ChatDetail = {
  id: number;
  character: { id: number; name: string; hasImage: boolean };
  persona: { id: number; name: string; hasImage: boolean } | null;
  preset: { id: number; name: string } | null;
  activeMessageId: number | null;
  messages: MessageInPath[];
};

export type ChatListItem = {
  id: number;
  character: { id: number; name: string; hasImage: boolean };
  persona: { id: number; name: string } | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  messageCount: number;
  createdAt: string;
};

export type TreeNode = {
  id: number;
  parentId: number | null;
  role: "user" | "assistant";
  content: string;
  isOnActivePath: boolean;
  createdAt: string;
};

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
    id: r.id as number,
    character: {
      id: r.char_id as number,
      name: r.char_name as string,
      hasImage: r.char_has_image as boolean,
    },
    persona: r.persona_id
      ? { id: r.persona_id as number, name: r.persona_name as string }
      : null,
    // lastMessage — зашифрован в characters.firstMessages, но не в messages.content
    lastMessage: r.last_message ? (r.last_message as string) : null,
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
      c.active_message_id,
      ch.id   AS char_id,
      ch.name AS char_name,
      ch.image IS NOT NULL AS char_has_image,
      p.id    AS persona_id,
      p.name  AS persona_name,
      p.image IS NOT NULL AS persona_has_image,
      pr.id   AS preset_id,
      pr.name AS preset_name
    FROM chats c
    JOIN characters ch ON ch.id = c.character_id
    LEFT JOIN personas p  ON p.id  = c.persona_id
    LEFT JOIN generation_presets pr ON pr.id = c.preset_id
    WHERE c.id = ${chatId} AND c.user_id = ${userId}
    LIMIT 1
  `);

  const chatRow = (chatRows as Record<string, unknown>[])[0];
  if (!chatRow) return undefined;

  const activeMessageId = chatRow.active_message_id as number | null;
  let messages: MessageInPath[] = [];

  if (activeMessageId) {
    // Рекурсивный CTE: путь от листа к корню + sibling-информация для каждого узла пути.
    // COALESCE(parent_id, -1) позволяет корню (parent_id IS NULL) попасть в одну group с
    // другими корнями через дополнительную группировку.
    const pathRows = await db.execute(sql`
      WITH RECURSIVE path AS (
        SELECT * FROM messages WHERE id = ${activeMessageId}
        UNION ALL
        SELECT m.* FROM messages m JOIN path p ON m.id = p.parent_id
      ),
      sibling_info AS (
        SELECT
          id,
          COALESCE(parent_id, -1)                                              AS group_key,
          COUNT(*)     OVER (PARTITION BY COALESCE(parent_id, -1))::int        AS sibling_count,
          (ROW_NUMBER() OVER (PARTITION BY COALESCE(parent_id, -1)
                              ORDER BY created_at) - 1)::int                   AS sibling_index,
          ARRAY_AGG(id ORDER BY created_at)
                       OVER (PARTITION BY COALESCE(parent_id, -1))             AS siblings
        FROM messages WHERE chat_id = ${chatId}
      )
      SELECT
        p.id, p.parent_id, p.role, p.content, p.translations, p.created_at,
        s.sibling_count, s.sibling_index, s.siblings
      FROM path p
      JOIN sibling_info s ON s.id = p.id
      ORDER BY p.created_at ASC
    `);

    messages = (pathRows as Record<string, unknown>[]).map((r) => ({
      id: r.id as number,
      parentId: r.parent_id as number | null,
      role: r.role as "user" | "assistant",
      content: r.content as string,
      translations: (r.translations as Record<string, string> | null) ?? null,
      createdAt: String(r.created_at),
      siblingIndex: r.sibling_index as number,
      siblingCount: r.sibling_count as number,
      siblings: r.siblings as number[],
    }));
  }

  logger.debug(
    { durationMs: Date.now() - t0, userId, chatId, messageCount: messages.length },
    "Chat loaded",
  );

  return {
    id: chatRow.id as number,
    character: {
      id: chatRow.char_id as number,
      name: chatRow.char_name as string,
      hasImage: chatRow.char_has_image as boolean,
    },
    persona: chatRow.persona_id
      ? {
          id: chatRow.persona_id as number,
          name: chatRow.persona_name as string,
          hasImage: chatRow.persona_has_image as boolean,
        }
      : null,
    preset: chatRow.preset_id
      ? { id: chatRow.preset_id as number, name: chatRow.preset_name as string }
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

  let activePath = new Set<number>();
  if (chat.activeMessageId) {
    // Собираем ID активного пути (только ID, без полного содержимого)
    const pathRows = await db.execute(sql`
      WITH RECURSIVE path AS (
        SELECT id, parent_id FROM messages WHERE id = ${chat.activeMessageId}
        UNION ALL
        SELECT m.id, m.parent_id FROM messages m JOIN path p ON m.id = p.parent_id
      )
      SELECT id FROM path
    `);
    activePath = new Set((pathRows as unknown as { id: number }[]).map((r) => r.id));
  }

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

  return allRows.map((r) => ({
    id: r.id,
    parentId: r.parentId,
    role: r.role as "user" | "assistant",
    content: r.content,
    isOnActivePath: activePath.has(r.id),
    createdAt: r.createdAt.toISOString(),
  }));
}

// ─── Создание чата ─────────────────────────────────────────────────────────────

/**
 * Создаёт чат и вставляет первое сообщение из character.firstMessages[0] (если есть).
 * Персонаж уже должен быть расшифрован вызывающей стороной.
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
      personaId: input.personaId ?? undefined,
      presetId: input.presetId ?? undefined,
    })
    .returning();
  const chat = chatRows[0]!;

  if (firstMessage) {
    const msgRows = await db
      .insert(schema.messages)
      .values({ chatId: chat.id, parentId: null, role: "assistant", content: firstMessage })
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

// ─── Сообщения ─────────────────────────────────────────────────────────────────

/** Вставляет новое сообщение и возвращает его. */
export async function insertMessage(
  chatId: number,
  parentId: number | null,
  role: "user" | "assistant",
  content: string,
): Promise<Message> {
  const rows = await db
    .insert(schema.messages)
    .values({ chatId, parentId, role, content })
    .returning();
  return rows[0]!;
}

/**
 * Читает одно сообщение по id (без проверки владельца — используется внутри сервера,
 * где chatId уже прошёл авторизацию).
 */
export async function getMessage(messageId: number): Promise<Message | undefined> {
  const rows = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.id, messageId));
  return rows[0];
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

/** Кэширует перевод сообщения: сливает новую запись в jsonb-объект translations. */
export async function saveTranslation(
  messageId: number,
  lang: string,
  text: string,
): Promise<void> {
  await db.execute(sql`
    UPDATE messages
    SET translations = COALESCE(translations, '{}'::jsonb) || jsonb_build_object(${lang}, ${text})
    WHERE id = ${messageId}
  `);
}

// ─── Настройки чата ────────────────────────────────────────────────────────────

export type ChatSettingsRow = {
  translateEnabled: boolean;
  translateTargetLang: string;
  translateScope: "all" | "assistant" | "user";
};

const DEFAULT_SETTINGS: ChatSettingsRow = {
  translateEnabled: false,
  translateTargetLang: "ru",
  translateScope: "assistant",
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

// ─── Внутренние хелперы ────────────────────────────────────────────────────────

/**
 * Рекурсивно спускается к листу дерева, следуя самому свежему ребёнку.
 * Нужно при переключении ветки в середине дерева — сохраняем существующее продолжение.
 */
async function findLeaf(chatId: number, messageId: number): Promise<number> {
  let current = messageId;
  for (;;) {
    const children = await db
      .select({ id: schema.messages.id })
      .from(schema.messages)
      .where(
        and(
          eq(schema.messages.parentId, current),
          eq(schema.messages.chatId, chatId),
        ),
      )
      .orderBy(desc(schema.messages.createdAt))
      .limit(1);
    if (children.length === 0) return current;
    current = children[0]!.id;
  }
}
