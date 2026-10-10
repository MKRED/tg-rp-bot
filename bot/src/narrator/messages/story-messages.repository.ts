import { Injectable } from "@nestjs/common";
import type { MessageRole, StoryMessageKind } from "@tg-rp-bot/shared";
import { and, eq, sql } from "drizzle-orm";
import { DatabaseService } from "../../database/database.service.js";
import { schema } from "../../db/index.js";
import type { StoryMessage as StoryMessageRow } from "../../db/schema.js";
import logger from "../../logger.js";
import { decryptField, decryptTranslations, encryptField } from "../../utils/index.js";
import { CompactionsRepository } from "../compaction/compactions.repository.js";
import { StoryPathRepository } from "../story-path.repository.js";
import { UserKeysService } from "../../user-keys/user-keys.service.js";

export type { StoryMessageRow };

/** Расшифровывает content и значения translations строки сообщения истории. */
function decryptRow(row: StoryMessageRow, key: Buffer): StoryMessageRow {
  return { ...row, content: decryptField(row.content, key), translations: decryptTranslations(row.translations, key) };
}

/**
 * Сообщения дерева истории и курсор активной ветки (story_chats.active_message_id). content и
 * значения translations зашифрованы per-user. Принадлежность истории проверяет вызывающий сервис.
 */
@Injectable()
export class StoryMessagesRepository {
  constructor(
    private readonly database: DatabaseService,
    private readonly path: StoryPathRepository,
    private readonly compactions: CompactionsRepository,
    private readonly keys: UserKeysService,
  ) {}

  /** Вставляет сообщение; возвращает его расшифрованным (уходит клиенту по SSE). */
  async insert(
    userId: string,
    storyId: number,
    parentId: number | null,
    role: MessageRole,
    kind: StoryMessageKind,
    content: string,
  ): Promise<StoryMessageRow> {
    const t0 = Date.now();
    const key = await this.keys.forUser(userId);
    const [row] = await this.database.db
      .insert(schema.storyMessages)
      .values({ storyChatId: storyId, parentId, role, kind, content: encryptField(content, key) })
      .returning();
    logger.debug({ durationMs: Date.now() - t0, userId, storyId, messageId: row!.id, role, kind }, "Story message inserted");
    return decryptRow(row!, await this.keys.forUser(userId));
  }

  /**
   * Сообщение этой истории, расшифрованное (история уже проверена вызывающим). storyId — в WHERE, а не
   * сравнением после: строку чужой истории расшифровать ключом пользователя нельзя (500 вместо 404).
   */
  async findOne(userId: string, storyId: number, messageId: number): Promise<StoryMessageRow | undefined> {
    const rows = await this.database.db
      .select()
      .from(schema.storyMessages)
      .where(and(eq(schema.storyMessages.id, messageId), eq(schema.storyMessages.storyChatId, storyId)));
    return rows[0] ? decryptRow(rows[0], await this.keys.forUser(userId)) : undefined;
  }

  /**
   * Правит текст бита на месте — без нового сиблинга, курсор и граф не меняются. Кэш перевода
   * сбрасывается: он относился к старому тексту.
   */
  async updateContent(userId: string, storyId: number, messageId: number, content: string): Promise<StoryMessageRow | undefined> {
    const rows = await this.database.db
      .update(schema.storyMessages)
      .set({ content: encryptField(content, await this.keys.forUser(userId)), translations: null })
      .where(and(eq(schema.storyMessages.id, messageId), eq(schema.storyMessages.storyChatId, storyId)))
      .returning();
    return rows[0] ? decryptRow(rows[0], await this.keys.forUser(userId)) : undefined;
  }

  /** Курсор — на лист под messageId (спуск по самым свежим детям). */
  async moveCursorToLeaf(storyId: number, messageId: number): Promise<void> {
    const t0 = Date.now();
    const leaf = await this.path.leafBelow(storyId, messageId);
    await this.setCursor(storyId, leaf);
    logger.debug({ durationMs: Date.now() - t0, storyId, messageId, leaf }, "Story cursor moved to leaf");
  }

  /** Курсор ровно на узел (или null), без спуска к листу. */
  async setCursor(storyId: number, messageId: number | null): Promise<void> {
    await this.database.db.update(schema.storyChats).set({ activeMessageId: messageId }).where(eq(schema.storyChats.id, storyId));
  }

  /**
   * Удаляет сообщение и поддерево, затем вычищает осиротевшие user-ходы вверх (история должна
   * заканчиваться битом, а не висящей директивой). Курсор на удалённом узле переносится на
   * выжившего предка; пересказы с якорем в удалённом — инвалидируются каскадом вперёд.
   */
  async removeSubtree(userId: string, storyId: number, messageId: number): Promise<boolean> {
    const t0 = Date.now();
    const msg = await this.findOne(userId, storyId, messageId);
    if (!msg) return false;
    const storyRows = await this.database.db
      .select({ activeMessageId: schema.storyChats.activeMessageId })
      .from(schema.storyChats)
      .where(eq(schema.storyChats.id, storyId));
    const story = storyRows[0];
    if (!story) return false;

    const descendantRows = await this.database.db.execute(sql`
      WITH RECURSIVE descendants AS (
        SELECT id FROM story_messages WHERE id = ${messageId} AND story_chat_id = ${storyId}
        UNION ALL
        SELECT m.id FROM story_messages m JOIN descendants d ON m.parent_id = d.id WHERE m.story_chat_id = ${storyId}
      )
      SELECT id FROM descendants
    `);
    const descendantIds = new Set((descendantRows as unknown as { id: unknown }[]).map((r) => Number(r.id)));
    // Курсор снимаем до удаления (FK на active_message_id нет); финально переставим после прунинга.
    if (story.activeMessageId != null && descendantIds.has(story.activeMessageId)) await this.setCursor(storyId, null);

    await this.database.db.execute(sql`
      WITH RECURSIVE descendants AS (
        SELECT id FROM story_messages WHERE id = ${messageId} AND story_chat_id = ${storyId}
        UNION ALL
        SELECT m.id FROM story_messages m JOIN descendants d ON m.parent_id = d.id WHERE m.story_chat_id = ${storyId}
      )
      DELETE FROM story_messages WHERE id IN (SELECT id FROM descendants)
    `);

    const { survivor, prunedIds } = await this.pruneOrphanSteers(storyId, msg.parentId);
    // Курсор мог стоять и в поддереве, и на выпрунутой директиве — переносим в обоих случаях.
    const removed = new Set([...descendantIds, ...prunedIds]);
    if (story.activeMessageId != null && removed.has(story.activeMessageId)) {
      // survivor == null — поднялись до корня; не должно случаться: openingBeat удалять нельзя (сервис).
      if (survivor != null) await this.moveCursorToLeaf(storyId, survivor);
      else await this.setCursor(storyId, null);
    }
    await this.compactions.invalidateByRemovedIds(storyId, removed);

    logger.info(
      { durationMs: Date.now() - t0, storyId, messageId, deletedCount: descendantIds.size + prunedIds.size },
      "Story message and descendants deleted",
    );
    return true;
  }

  /** Кэширует перевод: сливает запись в jsonb translations. Значение шифруется, код языка — открыт. */
  async saveTranslation(userId: string, messageId: number, lang: string, text: string): Promise<void> {
    const encrypted = encryptField(text, await this.keys.forUser(userId));
    await this.database.db.execute(sql`
      UPDATE story_messages
      SET translations = COALESCE(translations, '{}'::jsonb) || jsonb_build_object(${lang}::text, ${encrypted}::text)
      WHERE id = ${messageId}
    `);
  }

  /** Убирает закэшированный перевод для одного языка (остальные языки не трогает). */
  async deleteTranslation(messageId: number, lang: string): Promise<void> {
    await this.database.db.execute(sql`
      UPDATE story_messages SET translations = translations - ${lang}::text WHERE id = ${messageId}
    `);
  }

  /**
   * Поднимается от startId вверх, удаляя осиротевшие user-ходы (директива/continue без бита-ребёнка):
   * это мёртвый триггер, история не должна на нём заканчиваться. Стоп на первом бите или узле, у
   * которого ещё есть дети (другая ветка). Возвращает выжившего (на него встанет курсор) и id удалённых.
   */
  private async pruneOrphanSteers(storyId: number, startId: number | null): Promise<{ survivor: number | null; prunedIds: Set<number> }> {
    const prunedIds = new Set<number>();
    let current = startId;
    while (current != null) {
      const rows = await this.database.db
        .select({ role: schema.storyMessages.role, parentId: schema.storyMessages.parentId })
        .from(schema.storyMessages)
        .where(and(eq(schema.storyMessages.id, current), eq(schema.storyMessages.storyChatId, storyId)));
      const node = rows[0];
      if (!node || node.role !== "user") break;
      if ((await this.path.newestChild(storyId, current)) != null) break;
      await this.database.db.delete(schema.storyMessages).where(eq(schema.storyMessages.id, current));
      prunedIds.add(current);
      current = node.parentId;
    }
    return { survivor: current, prunedIds };
  }
}
