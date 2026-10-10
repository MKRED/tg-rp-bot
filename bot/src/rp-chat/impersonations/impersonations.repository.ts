import { Injectable } from "@nestjs/common";
import { MAX_IMPERSONATION_VARIANTS } from "@tg-rp-bot/shared";
import { and, desc, eq, isNull, notInArray, sql, type SQL } from "drizzle-orm";
import { DatabaseService } from "../../database/database.service.js";
import { schema } from "../../db/index.js";
import type { ImpersonationVariant } from "../../db/schema.js";
import logger from "../../logger.js";
import { decryptField, encryptField } from "../../utils/index.js";
import { UserKeysService } from "../../user-keys/user-keys.service.js";

/**
 * Фильтр «момента» = (chatId, parentMessageId). parentMessageId === null требует isNull,
 * иначе eq(col, null) даёт всегда-ложное условие — этот же фильтр используется и в вытеснении.
 */
function momentFilter(chatId: number, parentMessageId: number | null): SQL {
  const v = schema.impersonationVariants;
  return parentMessageId === null
    ? and(eq(v.chatId, chatId), isNull(v.parentMessageId))!
    : and(eq(v.chatId, chatId), eq(v.parentMessageId, parentMessageId))!;
}

/**
 * Сохранённые варианты реплик игрока (impersonate) по «моментам» диалога. content зашифрован
 * per-user. Принадлежность чата проверяет вызывающий сервис.
 */
@Injectable()
export class ImpersonationsRepository {
  constructor(
    private readonly database: DatabaseService,
    private readonly keys: UserKeysService,
  ) {}

  /** Варианты момента, свежие сверху (не более MAX_IMPERSONATION_VARIANTS), расшифрованные. */
  async list(userId: string, chatId: number, parentMessageId: number | null): Promise<ImpersonationVariant[]> {
    const v = schema.impersonationVariants;
    const rows = await this.database.db
      .select()
      .from(v)
      .where(momentFilter(chatId, parentMessageId))
      .orderBy(desc(v.createdAt))
      .limit(MAX_IMPERSONATION_VARIANTS);
    const key = await this.keys.forUser(userId);
    return rows.map((r) => ({ ...r, content: decryptField(r.content, key) }));
  }

  /**
   * Вставляет вариант и удаляет всё, что выходит за лимит момента (FIFO по createdAt).
   * content шифруется при записи, но возвращается расшифрованным (уходит клиенту по SSE).
   */
  async insert(userId: string, chatId: number, parentMessageId: number | null, content: string): Promise<ImpersonationVariant> {
    const t0 = Date.now();
    const v = schema.impersonationVariants;
    const key = await this.keys.forUser(userId);
    const [created] = await this.database.db
      .insert(v)
      .values({ chatId, parentMessageId, content: encryptField(content, key) })
      .returning();

    // keep всегда содержит хотя бы только что вставленную строку — notInArray не получит пустой массив.
    const keep = await this.database.db
      .select({ id: v.id })
      .from(v)
      .where(momentFilter(chatId, parentMessageId))
      .orderBy(desc(v.createdAt))
      .limit(MAX_IMPERSONATION_VARIANTS);
    const evicted = await this.database.db
      .delete(v)
      .where(and(momentFilter(chatId, parentMessageId), notInArray(v.id, keep.map((r) => r.id))))
      .returning({ id: v.id });

    logger.info(
      { durationMs: Date.now() - t0, chatId, parentMessageId, evicted: evicted.length },
      "Impersonation variant inserted",
    );
    return { ...created!, content: decryptField(created!.content, key) };
  }

  /** Сколько вариантов сохранено в чате по всем моментам. */
  async countForChat(chatId: number): Promise<number> {
    const v = schema.impersonationVariants;
    const rows = await this.database.db.select({ cnt: sql<number>`count(*)::int` }).from(v).where(eq(v.chatId, chatId));
    return rows[0]?.cnt ?? 0;
  }

  /** Удаляет все варианты чата (по всем моментам). Возвращает число удалённых. */
  async removeAll(chatId: number): Promise<number> {
    const t0 = Date.now();
    const v = schema.impersonationVariants;
    const deleted = await this.database.db.delete(v).where(eq(v.chatId, chatId)).returning({ id: v.id });
    logger.info({ durationMs: Date.now() - t0, chatId, deleted: deleted.length }, "Impersonation variants cleared");
    return deleted.length;
  }

  /** Удаляет один вариант; привязка к chatId не даёт удалить чужой вариант по голому id. */
  async remove(chatId: number, variantId: number): Promise<boolean> {
    const v = schema.impersonationVariants;
    const deleted = await this.database.db
      .delete(v)
      .where(and(eq(v.id, variantId), eq(v.chatId, chatId)))
      .returning({ id: v.id });
    return deleted.length > 0;
  }
}
