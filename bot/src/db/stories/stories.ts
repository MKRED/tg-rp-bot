import { and, eq, sql } from "drizzle-orm";
import logger from "../../logger.js";
import { decryptField, encryptField, getUserEncryptionKey } from "../../utils/index.js";
import { db, schema } from "../index.js";
import type { StoryChat } from "../schema.js";
import { listCompactionAnchors } from "./compactions.js";
import { decryptStoryTranslations } from "./crypto.js";
import { findLastStoryLeaf, queryStoryActivePath, queryStoryActivePathIds } from "./queries.js";
import type {
  StoryDetail,
  StoryInput,
  StoryListItem,
  StoryMessageInPath,
  StoryTreeNode,
} from "./types.js";

/** Маппит сырую строку пути в StoryMessageInPath, расшифровывая content и translations. */
function mapPathRow(r: Record<string, unknown>, key: Buffer): StoryMessageInPath {
  return {
    id: Number(r.id),
    parentId: r.parent_id != null ? Number(r.parent_id) : null,
    role: r.role as "user" | "assistant",
    kind: r.kind as "beat" | "continue" | "directive",
    content: decryptField(r.content as string, key),
    translations: decryptStoryTranslations(
      (r.translations as Record<string, string> | null) ?? null,
      key,
    ),
    createdAt: String(r.created_at),
    siblingIndex: r.sibling_index as number,
    siblingCount: r.sibling_count as number,
    siblings: (r.siblings as unknown[]).map(Number),
  };
}

/** Пагинированный список историй пользователя (свежие сверху). */
export async function listStories(
  userId: number,
  page: number,
  pageSize: number,
): Promise<{ items: StoryListItem[]; total: number }> {
  const t0 = Date.now();
  const offset = (page - 1) * pageSize;

  const rows = await db.execute(sql`
    SELECT
      s.id, s.title, s.created_at,
      b.name AS book_name,
      lm.content AS last_message,
      lm.created_at AS last_message_at,
      COALESCE(mc.cnt, 0) AS message_count
    FROM story_chats s
    JOIN knowledge_books b ON b.id = s.book_id
    LEFT JOIN LATERAL (
      SELECT content, created_at FROM story_messages
      WHERE story_chat_id = s.id ORDER BY created_at DESC LIMIT 1
    ) lm ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS cnt FROM story_messages WHERE story_chat_id = s.id
    ) mc ON TRUE
    WHERE s.user_id = ${userId}
    ORDER BY COALESCE(lm.created_at, s.created_at) DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `);

  const countRows = await db
    .select({ cnt: sql<number>`count(*)::int` })
    .from(schema.storyChats)
    .where(eq(schema.storyChats.userId, userId));
  const total = countRows[0]?.cnt ?? 0;
  const key = getUserEncryptionKey(userId);

  const items: StoryListItem[] = (rows as Record<string, unknown>[]).map((r) => ({
    // bigint из сырого SQL приходит строкой — приводим явно (как id сообщений в mapPathRow).
    id: Number(r.id),
    title: r.title ? decryptField(r.title as string, key) : null,
    bookName: r.book_name as string,
    lastMessage: r.last_message ? decryptField(r.last_message as string, key) : null,
    lastMessageAt: r.last_message_at ? String(r.last_message_at) : null,
    messageCount: r.message_count as number,
    createdAt: String(r.created_at),
  }));

  logger.debug({ durationMs: Date.now() - t0, userId, page, total }, "Stories listed");
  return { items, total };
}

/** Читает историю + активный путь (рекурсивный CTE от activeMessageId). */
export async function getStory(userId: number, storyId: number): Promise<StoryDetail | undefined> {
  const t0 = Date.now();

  const storyRows = await db.execute(sql`
    SELECT
      s.id, s.title, s.premise, s.active_message_id,
      b.id AS book_id, b.name AS book_name,
      t.id AS template_id, t.name AS template_name,
      pr.id AS preset_id, pr.name AS preset_name
    FROM story_chats s
    JOIN knowledge_books b ON b.id = s.book_id
    LEFT JOIN narrator_templates t ON t.id = s.template_id
    LEFT JOIN generation_presets pr ON pr.id = s.preset_id
    WHERE s.id = ${storyId} AND s.user_id = ${userId}
    LIMIT 1
  `);
  const storyRow = (storyRows as Record<string, unknown>[])[0];
  if (!storyRow) return undefined;

  const key = getUserEncryptionKey(userId);
  let activeMessageId =
    storyRow.active_message_id != null ? Number(storyRow.active_message_id) : null;
  let messages: StoryMessageInPath[] = [];

  if (activeMessageId) {
    let pathRows = await queryStoryActivePath(storyId, activeMessageId);
    // Самовосстановление: курсор указывает на удалённый узел → берём последний лист.
    if (pathRows.length === 0) {
      const leafId = await findLastStoryLeaf(storyId);
      if (leafId) {
        await db
          .update(schema.storyChats)
          .set({ activeMessageId: leafId })
          .where(eq(schema.storyChats.id, storyId));
        activeMessageId = leafId;
        pathRows = await queryStoryActivePath(storyId, leafId);
      }
    }
    messages = pathRows.map((r) => mapPathRow(r, key));
  }

  logger.debug(
    { durationMs: Date.now() - t0, userId, storyId, messageCount: messages.length },
    "Story loaded",
  );

  return {
    // bigint из сырого SQL приходит строкой — все id приводим к number явно.
    id: Number(storyRow.id),
    title: storyRow.title ? decryptField(storyRow.title as string, key) : null,
    book: { id: Number(storyRow.book_id), name: storyRow.book_name as string },
    template: storyRow.template_id
      ? { id: Number(storyRow.template_id), name: storyRow.template_name as string }
      : null,
    preset: storyRow.preset_id
      ? { id: Number(storyRow.preset_id), name: storyRow.preset_name as string }
      : null,
    premise: decryptField((storyRow.premise as string | null) ?? "", key),
    activeMessageId,
    messages,
  };
}

/** Все сообщения истории плоским массивом с флагом isOnActivePath (для страницы графа). */
export async function getStoryTree(userId: number, storyId: number): Promise<StoryTreeNode[]> {
  const t0 = Date.now();

  // Проверяем принадлежность истории пользователю.
  const storyRows = await db
    .select({ id: schema.storyChats.id, activeMessageId: schema.storyChats.activeMessageId })
    .from(schema.storyChats)
    .where(and(eq(schema.storyChats.id, storyId), eq(schema.storyChats.userId, userId)));
  const story = storyRows[0];
  if (!story) return [];

  const activePath = story.activeMessageId
    ? await queryStoryActivePathIds(story.activeMessageId)
    : new Set<number>();

  const allRows = await db
    .select({
      id: schema.storyMessages.id,
      parentId: schema.storyMessages.parentId,
      role: schema.storyMessages.role,
      kind: schema.storyMessages.kind,
      content: schema.storyMessages.content,
      createdAt: schema.storyMessages.createdAt,
    })
    .from(schema.storyMessages)
    .where(eq(schema.storyMessages.storyChatId, storyId))
    .orderBy(schema.storyMessages.createdAt);

  const anchors = await listCompactionAnchors(storyId);
  const compactedIds = collectCompactedIds(anchors, allRows);

  logger.debug(
    { durationMs: Date.now() - t0, userId, storyId, count: allRows.length },
    "Story tree loaded",
  );

  // content зашифрован per-user — расшифровываем для узлов графа.
  const key = getUserEncryptionKey(userId);
  return allRows.map((r) => ({
    id: r.id,
    parentId: r.parentId,
    role: r.role as "user" | "assistant",
    kind: r.kind as "beat" | "continue" | "directive",
    content: decryptField(r.content, key),
    isOnActivePath: activePath.has(r.id),
    isCompacted: compactedIds.has(r.id),
    createdAt: r.createdAt.toISOString(),
  }));
}

/**
 * Сообщения, попавшие в диапазон (fromAnchorId, toAnchorId] какого-то пересказа — структурно,
 * по цепочке parentId (якоря ссылаются на конкретные id, не зависят от того, какая ветка активна
 * сейчас). Так подсвечиваем на графе именно ту ветку, где реально было сжатие.
 */
function collectCompactedIds(
  anchors: { fromAnchorId: number | null; toAnchorId: number }[],
  rows: { id: number; parentId: number | null }[],
): Set<number> {
  const parentOf = new Map(rows.map((r) => [r.id, r.parentId]));
  const compacted = new Set<number>();
  for (const { fromAnchorId, toAnchorId } of anchors) {
    let cur: number | null = toAnchorId;
    while (cur !== null && cur !== fromAnchorId) {
      compacted.add(cur);
      cur = parentOf.get(cur) ?? null;
    }
  }
  return compacted;
}

/**
 * Создаёт историю и вставляет ОБЯЗАТЕЛЬНОЕ авторское открытие как дословный бит 1
 * (role assistant, kind beat, parentId null). openingBeat/premise зашифрованы per-user.
 */
export async function createStory(
  userId: number,
  input: StoryInput,
  openingBeat: string,
  premise: string,
): Promise<StoryChat> {
  const t0 = Date.now();
  const key = getUserEncryptionKey(userId);

  const storyRows = await db
    .insert(schema.storyChats)
    .values({
      userId,
      bookId: input.bookId,
      templateId: input.templateId,
      presetId: input.presetId,
      openingBeat: encryptField(openingBeat, key),
      premise: encryptField(premise, key),
    })
    .returning();
  const story = storyRows[0]!;

  const msgRows = await db
    .insert(schema.storyMessages)
    .values({
      storyChatId: story.id,
      parentId: null,
      role: "assistant",
      kind: "beat",
      content: encryptField(openingBeat, key),
    })
    .returning();
  const msg = msgRows[0]!;
  await db
    .update(schema.storyChats)
    .set({ activeMessageId: msg.id })
    .where(eq(schema.storyChats.id, story.id));
  story.activeMessageId = msg.id;

  logger.info({ durationMs: Date.now() - t0, userId, storyId: story.id }, "Story created");
  return story;
}

/** Переименовывает историю (только свою). Пусто → title = null. Возвращает применённый title. */
export async function renameStory(
  userId: number,
  storyId: number,
  rawTitle: string,
): Promise<{ title: string | null } | undefined> {
  const t0 = Date.now();
  const trimmed = rawTitle.trim();
  const title = trimmed.length > 0 ? trimmed : null;
  const key = getUserEncryptionKey(userId);

  const rows = await db
    .update(schema.storyChats)
    .set({ title: title != null ? encryptField(title, key) : null })
    .where(and(eq(schema.storyChats.id, storyId), eq(schema.storyChats.userId, userId)))
    .returning({ id: schema.storyChats.id });
  logger.info({ durationMs: Date.now() - t0, userId, storyId, found: rows.length > 0 }, "Story rename attempted");
  if (rows.length === 0) return undefined;
  return { title };
}

/**
 * Обновляет премизу истории (только свою). Премизу храним как есть (даже ""), как и createStory —
 * без коэрции пусто→null: getStory читает её через `?? ""`. Возвращает применённое значение.
 */
export async function updateStoryPremise(
  userId: number,
  storyId: number,
  rawPremise: string,
): Promise<{ premise: string } | undefined> {
  const t0 = Date.now();
  const premise = rawPremise.trim();
  const key = getUserEncryptionKey(userId);

  const rows = await db
    .update(schema.storyChats)
    .set({ premise: encryptField(premise, key) })
    .where(and(eq(schema.storyChats.id, storyId), eq(schema.storyChats.userId, userId)))
    .returning({ id: schema.storyChats.id });
  logger.info(
    { durationMs: Date.now() - t0, userId, storyId, found: rows.length > 0 },
    "Story premise update attempted",
  );
  if (rows.length === 0) return undefined;
  return { premise };
}

/** Удаляет историю (только свою). true — если удалена. */
export async function deleteStory(userId: number, storyId: number): Promise<boolean> {
  const t0 = Date.now();
  const rows = await db
    .delete(schema.storyChats)
    .where(and(eq(schema.storyChats.id, storyId), eq(schema.storyChats.userId, userId)))
    .returning({ id: schema.storyChats.id });
  const deleted = rows.length > 0;
  logger.info({ durationMs: Date.now() - t0, userId, storyId, deleted }, "Story delete attempted");
  return deleted;
}
