import { Injectable } from "@nestjs/common";
import type { MessageRole, StoryDetail, StoryListItem, StoryMessage, StoryMessageKind, StoryTreeNode } from "@tg-rp-bot/shared";
import { and, eq, sql } from "drizzle-orm";
import { DatabaseService } from "../../database/database.service.js";
import { schema } from "../../db/index.js";
import type { StoryChat } from "../../db/schema.js";
import logger from "../../logger.js";
import { decryptField, decryptTranslations, encryptField } from "../../utils/index.js";
import { type CompactionAnchors, collectCompactedIds } from "../compaction/compacted-ids.js";
import { StoryPathRepository } from "../story-path.repository.js";
import { bookAvatarsLateral, mapStoryAvatars } from "./story-avatars.js";
import { UserKeysService } from "../../user-keys/user-keys.service.js";

/** Книга, шаблон и пресет, выбранные при создании истории. */
export type StoryRefs = { bookId: number; templateId: number; presetId: number };

/** Лёгкая строка истории без сообщений: принадлежность, курсор и id связанных сущностей. */
export type StoryRow = Pick<StoryChat, "id" | "activeMessageId" | "bookId" | "templateId" | "presetId">;

/** Сколько аватаров показываем в стеке списка историй / шапке истории (см. AvatarStack). */
const LIST_AVATAR_LIMIT = 3;
const HEADER_AVATAR_LIMIT = 5;

/** Маппит сырую строку пути (StoryPathRepository.activePath) в StoryMessage, расшифровывая поля. */
function mapPathRow(r: Record<string, unknown>, key: Buffer): StoryMessage {
  return {
    id: Number(r.id),
    parentId: r.parent_id != null ? Number(r.parent_id) : null,
    role: r.role as MessageRole,
    kind: r.kind as StoryMessageKind,
    content: decryptField(r.content as string, key),
    translations: decryptTranslations((r.translations as Record<string, string> | null) ?? null, key),
    createdAt: String(r.created_at),
    siblingIndex: r.sibling_index as number,
    siblingCount: r.sibling_count as number,
    siblings: (r.siblings as unknown[]).map(Number),
  };
}

/** Истории пользователя (story_chats). title, premise и content сообщений зашифрованы per-user. */
@Injectable()
export class StoriesRepository {
  constructor(
    private readonly database: DatabaseService,
    private readonly path: StoryPathRepository,
    private readonly keys: UserKeysService,
  ) {}

  /** Пагинированный список историй пользователя (свежие по последнему сообщению сверху). */
  async list(userId: string, page: number, pageSize: number): Promise<{ items: StoryListItem[]; total: number }> {
    const t0 = Date.now();
    const offset = (page - 1) * pageSize;
    const rows = await this.database.db.execute(sql`
      SELECT
        s.id, s.title, s.created_at,
        b.name AS book_name,
        lm.content AS last_message,
        lm.created_at AS last_message_at,
        COALESCE(mc.cnt, 0) AS message_count,
        av.avatars
      FROM story_chats s
      JOIN knowledge_books b ON b.id = s.book_id
      LEFT JOIN LATERAL (
        SELECT content, created_at FROM story_messages
        WHERE story_chat_id = s.id ORDER BY created_at DESC LIMIT 1
      ) lm ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt FROM story_messages WHERE story_chat_id = s.id
      ) mc ON TRUE
      ${bookAvatarsLateral(LIST_AVATAR_LIMIT)}
      WHERE s.user_id = ${userId}
      ORDER BY COALESCE(lm.created_at, s.created_at) DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `);
    const countRows = await this.database.db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(schema.storyChats)
      .where(eq(schema.storyChats.userId, userId));
    const total = countRows[0]?.cnt ?? 0;
    const key = await this.keys.forUser(userId);

    const items: StoryListItem[] = (rows as Record<string, unknown>[]).map((r) => ({
      // bigint из сырого SQL приходит строкой — приводим явно.
      id: Number(r.id),
      title: r.title ? decryptField(r.title as string, key) : null,
      bookName: r.book_name as string,
      lastMessage: r.last_message ? decryptField(r.last_message as string, key) : null,
      lastMessageAt: r.last_message_at ? String(r.last_message_at) : null,
      messageCount: r.message_count as number,
      createdAt: String(r.created_at),
      avatars: mapStoryAvatars(r.avatars),
    }));
    logger.debug({ durationMs: Date.now() - t0, userId, page, total }, "Stories listed");
    return { items, total };
  }

  /** Строка истории пользователя без сообщений — для проверки принадлежности и курсора. */
  async findRow(userId: string, storyId: number): Promise<StoryRow | undefined> {
    const rows = await this.database.db
      .select({
        id: schema.storyChats.id,
        activeMessageId: schema.storyChats.activeMessageId,
        bookId: schema.storyChats.bookId,
        templateId: schema.storyChats.templateId,
        presetId: schema.storyChats.presetId,
      })
      .from(schema.storyChats)
      .where(and(eq(schema.storyChats.id, storyId), eq(schema.storyChats.userId, userId)));
    return rows[0];
  }

  /**
   * История с активным путём. Курсор указывает на удалённый узел (FK на active_message_id нет) —
   * самовосстановление: курсор переносится на самый свежий лист.
   */
  async findDetail(userId: string, storyId: number): Promise<StoryDetail | undefined> {
    const t0 = Date.now();
    const storyRows = await this.database.db.execute(sql`
      SELECT
        s.id, s.title, s.premise, s.active_message_id,
        b.id AS book_id, b.name AS book_name,
        t.id AS template_id, t.name AS template_name,
        pr.id AS preset_id, pr.name AS preset_name,
        av.avatars
      FROM story_chats s
      JOIN knowledge_books b ON b.id = s.book_id
      LEFT JOIN narrator_templates t ON t.id = s.template_id
      LEFT JOIN generation_presets pr ON pr.id = s.preset_id
      ${bookAvatarsLateral(HEADER_AVATAR_LIMIT)}
      WHERE s.id = ${storyId} AND s.user_id = ${userId}
      LIMIT 1
    `);
    const row = (storyRows as Record<string, unknown>[])[0];
    if (!row) return undefined;

    const key = await this.keys.forUser(userId);
    let activeMessageId = row.active_message_id != null ? Number(row.active_message_id) : null;
    let messages: StoryMessage[] = [];
    if (activeMessageId) {
      let pathRows = await this.path.activePath(storyId, activeMessageId);
      if (pathRows.length === 0) {
        const leafId = await this.path.lastLeaf(storyId);
        if (leafId) {
          await this.database.db.update(schema.storyChats).set({ activeMessageId: leafId }).where(eq(schema.storyChats.id, storyId));
          activeMessageId = leafId;
          pathRows = await this.path.activePath(storyId, leafId);
        }
      }
      messages = pathRows.map((r) => mapPathRow(r, key));
    }
    logger.debug({ durationMs: Date.now() - t0, userId, storyId, messageCount: messages.length }, "Story loaded");

    return {
      id: Number(row.id),
      title: row.title ? decryptField(row.title as string, key) : null,
      book: { id: Number(row.book_id), name: row.book_name as string, avatars: mapStoryAvatars(row.avatars) },
      template: row.template_id ? { id: Number(row.template_id), name: row.template_name as string } : null,
      preset: row.preset_id ? { id: Number(row.preset_id), name: row.preset_name as string } : null,
      premise: decryptField((row.premise as string | null) ?? "", key),
      activeMessageId,
      messages,
    };
  }

  /** Все сообщения истории плоским массивом с флагами активного пути и сжатия (граф веток). */
  async tree(userId: string, story: StoryRow, anchors: CompactionAnchors[]): Promise<StoryTreeNode[]> {
    const t0 = Date.now();
    const activePath = story.activeMessageId ? await this.path.activePathIds(story.activeMessageId) : new Set<number>();
    const rows = await this.database.db
      .select({
        id: schema.storyMessages.id,
        parentId: schema.storyMessages.parentId,
        role: schema.storyMessages.role,
        kind: schema.storyMessages.kind,
        content: schema.storyMessages.content,
        createdAt: schema.storyMessages.createdAt,
      })
      .from(schema.storyMessages)
      .where(eq(schema.storyMessages.storyChatId, story.id))
      .orderBy(schema.storyMessages.createdAt);
    const compacted = collectCompactedIds(anchors, rows);
    logger.debug({ durationMs: Date.now() - t0, userId, storyId: story.id, count: rows.length }, "Story tree loaded");

    const key = await this.keys.forUser(userId);
    return rows.map((r) => ({
      id: r.id,
      parentId: r.parentId,
      role: r.role,
      kind: r.kind,
      content: decryptField(r.content, key),
      isOnActivePath: activePath.has(r.id),
      isCompacted: compacted.has(r.id),
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /**
   * Создаёт историю и вставляет обязательное авторское открытие как дословный бит 1 (assistant, beat,
   * без родителя); курсор — на него. openingBeat/premise шифруются per-user.
   */
  async create(userId: string, refs: StoryRefs, openingBeat: string, premise: string): Promise<StoryChat> {
    const t0 = Date.now();
    const key = await this.keys.forUser(userId);
    const [story] = await this.database.db
      .insert(schema.storyChats)
      .values({ userId, ...refs, premise: encryptField(premise, key) })
      .returning();
    const [msg] = await this.database.db
      .insert(schema.storyMessages)
      .values({ storyChatId: story!.id, parentId: null, role: "assistant", kind: "beat", content: encryptField(openingBeat, key) })
      .returning();
    await this.database.db.update(schema.storyChats).set({ activeMessageId: msg!.id }).where(eq(schema.storyChats.id, story!.id));
    logger.info({ durationMs: Date.now() - t0, userId, storyId: story!.id }, "Story created");
    return { ...story!, activeMessageId: msg!.id };
  }

  /** Переименовывает историю. Пусто после trim → title = null. undefined — истории нет у пользователя. */
  async rename(userId: string, storyId: number, rawTitle: string): Promise<{ title: string | null } | undefined> {
    const t0 = Date.now();
    const trimmed = rawTitle.trim();
    const title = trimmed.length > 0 ? trimmed : null;
    const key = await this.keys.forUser(userId);
    const rows = await this.database.db
      .update(schema.storyChats)
      .set({ title: title != null ? encryptField(title, key) : null })
      .where(and(eq(schema.storyChats.id, storyId), eq(schema.storyChats.userId, userId)))
      .returning({ id: schema.storyChats.id });
    logger.info({ durationMs: Date.now() - t0, userId, storyId, found: rows.length > 0 }, "Story renamed");
    return rows.length > 0 ? { title } : undefined;
  }

  /**
   * Обновляет премизу. Храним как есть после trim (даже "") — без коэрции пусто→null: findDetail
   * читает её через `?? ""`. undefined — истории нет у пользователя.
   */
  async updatePremise(userId: string, storyId: number, rawPremise: string): Promise<{ premise: string } | undefined> {
    const t0 = Date.now();
    const premise = rawPremise.trim();
    const key = await this.keys.forUser(userId);
    const rows = await this.database.db
      .update(schema.storyChats)
      .set({ premise: encryptField(premise, key) })
      .where(and(eq(schema.storyChats.id, storyId), eq(schema.storyChats.userId, userId)))
      .returning({ id: schema.storyChats.id });
    logger.info({ durationMs: Date.now() - t0, userId, storyId, found: rows.length > 0 }, "Story premise updated");
    return rows.length > 0 ? { premise } : undefined;
  }

  /** Удаляет историю (сообщения, настройки и пересказы — каскадом FK). */
  async remove(userId: string, storyId: number): Promise<boolean> {
    const t0 = Date.now();
    const rows = await this.database.db
      .delete(schema.storyChats)
      .where(and(eq(schema.storyChats.id, storyId), eq(schema.storyChats.userId, userId)))
      .returning({ id: schema.storyChats.id });
    logger.info({ durationMs: Date.now() - t0, userId, storyId, deleted: rows.length > 0 }, "Story deleted");
    return rows.length > 0;
  }
}
