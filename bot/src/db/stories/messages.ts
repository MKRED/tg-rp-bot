import { and, eq, sql } from "drizzle-orm";
import logger from "../../logger.js";
import { decryptField, encryptField, getUserEncryptionKey } from "../../utils/index.js";
import { db, schema } from "../index.js";
import type { StoryMessage } from "../schema.js";
import { invalidateCompactionsByRemovedIds } from "./compactions.js";
import { decryptStoryTranslations } from "./crypto.js";
import { findStoryLeaf } from "./queries.js";

/** Расшифровывает content + значения translations строки сообщения истории. */
function decryptRow(row: StoryMessage, userId: number): StoryMessage {
  const key = getUserEncryptionKey(userId);
  return {
    ...row,
    content: decryptField(row.content, key),
    translations: decryptStoryTranslations(row.translations, key),
  };
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

/**
 * Кэширует перевод бита/директивы: сливает новую запись в jsonb-объект translations.
 * Значение шифруется per-user; ключ (код языка) остаётся открытым. Зеркало saveTranslation (RP).
 */
export async function saveStoryTranslation(
  userId: number,
  messageId: number,
  lang: string,
  text: string,
): Promise<void> {
  const t0 = Date.now();
  const key = getUserEncryptionKey(userId);
  const encrypted = encryptField(text, key);
  await db.execute(sql`
    UPDATE story_messages
    SET translations = COALESCE(translations, '{}'::jsonb) || jsonb_build_object(${lang}::text, ${encrypted}::text)
    WHERE id = ${messageId}
  `);
  logger.debug({ durationMs: Date.now() - t0, userId, messageId, lang }, "Story translation cached");
}

/**
 * Убирает закэшированный перевод для одного языка (остальные языки не трогает).
 * Зеркало deleteTranslation (RP).
 */
export async function deleteStoryTranslation(messageId: number, lang: string): Promise<void> {
  const t0 = Date.now();
  await db.execute(sql`
    UPDATE story_messages
    SET translations = translations - ${lang}::text
    WHERE id = ${messageId}
  `);
  logger.debug({ durationMs: Date.now() - t0, messageId, lang }, "Story translation deleted");
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
 * Поднимается от startId вверх, удаляя осиротевшие user-ходы (директива/continue без бита-ребёнка).
 * Такой узел — мёртвый триггер: его последствие (следующий бит) удалено, история не должна на нём
 * заканчиваться (висящая директива-чип в ленте; continue в ленте скрыт, но так же ломает состояние).
 * Останавливаемся на первом бите (assistant) или узле, у которого ещё остались дети (например
 * бит-сиблинг после регенерации). Возвращает узел-«выжившего» (на него встанет курсор) и id удалённых.
 */
async function pruneOrphanSteers(
  storyChatId: number,
  startId: number | null,
): Promise<{ survivor: number | null; prunedIds: Set<number> }> {
  const prunedIds = new Set<number>();
  let current = startId;
  while (current != null) {
    const rows = await db
      .select({
        id: schema.storyMessages.id,
        role: schema.storyMessages.role,
        parentId: schema.storyMessages.parentId,
      })
      .from(schema.storyMessages)
      .where(
        and(eq(schema.storyMessages.id, current), eq(schema.storyMessages.storyChatId, storyChatId)),
      );
    const node = rows[0];
    if (!node) break;
    // Бит (assistant) — валидный конец истории, выше не поднимаемся.
    if (node.role !== "user") break;
    // Есть ещё дети (другая ветка/бит-сиблинг) — это не сирота, оставляем.
    const children = await db
      .select({ id: schema.storyMessages.id })
      .from(schema.storyMessages)
      .where(
        and(
          eq(schema.storyMessages.parentId, current),
          eq(schema.storyMessages.storyChatId, storyChatId),
        ),
      )
      .limit(1);
    if (children.length > 0) break;
    // Осиротевший user-ход — удаляем и поднимаемся к родителю.
    await db.delete(schema.storyMessages).where(eq(schema.storyMessages.id, current));
    prunedIds.add(current);
    current = node.parentId;
  }
  return { survivor: current, prunedIds };
}

/**
 * Удаляет сообщение истории и всё поддерево, затем вычищает осиротевшие user-ходы вверх (мёртвые
 * триггеры без бита — история должна заканчиваться битом, а не висящей директивой). Если курсор
 * указывал на что-либо удалённое — переставляет его на выжившего предка (бит). Зеркало
 * db/chats/messages.ts deleteMessage + narrator-инвариант «конец истории = бит».
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
  // Курсор временно снимаем, если он внутри удаляемого поддерева (activeMessageId — не FK, но
  // не должен повисать на удалённом узле). Финально переставим его ниже, после прунинга.
  if (story.activeMessageId != null && descendantIds.has(story.activeMessageId)) {
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

  // Вычищаем осиротевшую цепочку user-ходов над удалённым (директива → удалённый бит).
  const { survivor, prunedIds } = await pruneOrphanSteers(storyChatId, msg.parentId);

  // Курсор перезаписываем, если он указывал на ЛЮБОЙ удалённый узел — поддерево ИЛИ выпрунутую
  // директиву (курсор мог стоять на ней — это и есть исправляемое «история кончается директивой»).
  const removed = new Set([...descendantIds, ...prunedIds]);
  if (story.activeMessageId != null && removed.has(story.activeMessageId)) {
    if (survivor != null) {
      await updateActiveStoryMessage(storyChatId, survivor);
    } else {
      // Поднялись до корня — не должно случаться: openingBeat удалять нельзя (защита в хендлере).
      await setActiveStoryMessage(storyChatId, null);
    }
  }

  // Инвалидция пересказов: если якорь какого-то компакта попал в удалённые id — убираем его и все
  // последующие (каскад вперёд), иначе пересказ повис бы над удалённым контентом.
  await invalidateCompactionsByRemovedIds(storyChatId, removed);

  logger.info(
    {
      durationMs: Date.now() - t0,
      storyChatId,
      messageId,
      deletedCount: descendantIds.size + prunedIds.size,
    },
    "Story message and descendants deleted",
  );
  return true;
}
