import { and, desc, eq, isNull, notInArray, type SQL } from "drizzle-orm";
import logger from "../logger.js";
import { decryptField, encryptField, getUserEncryptionKey } from "../utils/index.js";
import { db, schema } from "./index.js";
import type { ImpersonationVariant } from "./schema.js";

/** Максимум вариантов на один момент диалога — далее FIFO-эвикт самого старого. */
const MAX_VARIANTS_PER_MOMENT = 20;

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
