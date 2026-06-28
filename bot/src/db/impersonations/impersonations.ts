import { and, desc, eq, isNull, notInArray, sql, type SQL } from "drizzle-orm";
import logger from "../../logger.js";
import { decryptField, encryptField, getUserEncryptionKey } from "../../utils/index.js";
import { db, schema } from "../index.js";
import type { ImpersonationVariant } from "../schema.js";
import { MAX_VARIANTS_PER_MOMENT } from "./impersonations.constants.js";

/**
 * Фильтр «момента» = (chatId, parentMessageId). parentMessageId === null требует isNull,
 * иначе eq(col, null) даёт всегда-ложное условие — этот же фильтр используется и в эвикте.
 */
function momentFilter(chatId: number, parentMessageId: number | null): SQL {
  const v = schema.impersonationVariants;
  return parentMessageId === null
    ? and(eq(v.chatId, chatId), isNull(v.parentMessageId))!
    : and(eq(v.chatId, chatId), eq(v.parentMessageId, parentMessageId))!;
}

/** Варианты момента, свежие сверху (не более MAX_VARIANTS_PER_MOMENT). content расшифрован per-user. */
export async function listVariants(
  userId: number,
  chatId: number,
  parentMessageId: number | null,
): Promise<ImpersonationVariant[]> {
  const v = schema.impersonationVariants;
  const rows = await db
    .select()
    .from(v)
    .where(momentFilter(chatId, parentMessageId))
    .orderBy(desc(v.createdAt))
    .limit(MAX_VARIANTS_PER_MOMENT);
  const key = getUserEncryptionKey(userId);
  return rows.map((r) => ({ ...r, content: decryptField(r.content, key) }));
}

/**
 * Вставляет вариант и удаляет всё, что выходит за лимит момента (FIFO по createdAt).
 * content шифруется per-user при записи, но возвращается расшифрованным (уходит клиенту по SSE).
 */
export async function insertVariant(
  userId: number,
  chatId: number,
  parentMessageId: number | null,
  content: string,
): Promise<ImpersonationVariant> {
  const t0 = Date.now();
  const v = schema.impersonationVariants;
  const key = getUserEncryptionKey(userId);

  const rows = await db
    .insert(v)
    .values({ chatId, parentMessageId, content: encryptField(content, key) })
    .returning();
  const created = rows[0]!; // insert ... returning всегда отдаёт строку

  // Оставляем 20 свежих этого момента, остальные удаляем. keep всегда содержит хотя бы
  // только что вставленную строку, поэтому notInArray не получает пустой массив.
  const keep = await db
    .select({ id: v.id })
    .from(v)
    .where(momentFilter(chatId, parentMessageId))
    .orderBy(desc(v.createdAt))
    .limit(MAX_VARIANTS_PER_MOMENT);
  const deleted = await db
    .delete(v)
    .where(and(momentFilter(chatId, parentMessageId), notInArray(v.id, keep.map((r) => r.id))))
    .returning({ id: v.id });

  logger.info(
    { durationMs: Date.now() - t0, chatId, parentMessageId, evicted: deleted.length },
    "Impersonation variant inserted",
  );
  return { ...created, content: decryptField(created.content, key) };
}

/** Сколько всего сохранённых вариантов реплик существует для чата (по всем моментам). */
export async function countVariantsForChat(chatId: number): Promise<number> {
  const v = schema.impersonationVariants;
  const rows = await db
    .select({ cnt: sql<number>`count(*)::int` })
    .from(v)
    .where(eq(v.chatId, chatId));
  return rows[0]?.cnt ?? 0;
}

/** Удаляет все сохранённые варианты реплик чата (по всем моментам). Возвращает число удалённых строк. */
export async function deleteAllVariantsForChat(chatId: number): Promise<number> {
  const t0 = Date.now();
  const v = schema.impersonationVariants;
  const deleted = await db
    .delete(v)
    .where(eq(v.chatId, chatId))
    .returning({ id: v.id });
  logger.info({ durationMs: Date.now() - t0, chatId, deleted: deleted.length }, "Impersonation variants cleared");
  return deleted.length;
}

/**
 * Удаляет один вариант момента. Привязка к chatId — защита от удаления чужого варианта
 * по голому id (принадлежность чата пользователю проверяется в хендлере через getChat).
 * Возвращает true, если строка действительно была удалена.
 */
export async function deleteVariant(chatId: number, variantId: number): Promise<boolean> {
  const v = schema.impersonationVariants;
  const deleted = await db
    .delete(v)
    .where(and(eq(v.id, variantId), eq(v.chatId, chatId)))
    .returning({ id: v.id });
  return deleted.length > 0;
}
