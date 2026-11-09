import { Injectable } from "@nestjs/common";
import { MAX_CANVAS_DRAFTS, type ComfyModelId } from "@tg-rp-bot/shared";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { DatabaseService } from "../database/database.service.js";
import { schema } from "../db/index.js";
import logger from "../logger.js";
import { UserKeysService } from "../user-keys/user-keys.service.js";
import { decryptField, encryptField } from "../utils/index.js";

export type CanvasItemKind = "draft" | "variant";

/** Черновик или вариант без самой картинки. */
export interface CanvasItemMeta {
  id: number;
  kind: CanvasItemKind;
  thumb: string | null;
  prompt: string;
  model: ComfyModelId;
  seed: number;
  width: number | null;
  height: number | null;
  createdAt: Date;
}

export interface NewDraft {
  image: string;
  prompt: string;
  model: ComfyModelId;
  seed: number;
  width: number | null;
  height: number | null;
}

/** Для списка холстов: число вариантов и миниатюра последнего. */
export interface CanvasVariantSummary {
  canvasId: number;
  variantCount: number;
  lastThumb: string | null;
}

/**
 * Таблица image_canvas_items: черновики и варианты холстов. Картинка читается только поштучно
 * (getImage) — в списках её нет. image, thumb, prompt шифруются per-user.
 */
@Injectable()
export class ImageCanvasItemsRepository {
  constructor(
    private readonly database: DatabaseService,
    private readonly keys: UserKeysService,
  ) {}

  private get table() {
    return schema.imageCanvasItems;
  }

  private owned(userId: string, canvasId: number, id: number) {
    return and(eq(this.table.id, id), eq(this.table.canvasId, canvasId), eq(this.table.userId, userId));
  }

  /** Все черновики и варианты холста, новые первыми. */
  async list(userId: string, canvasId: number): Promise<CanvasItemMeta[]> {
    const t0 = Date.now();
    const rows = await this.database.db
      .select({
        id: this.table.id,
        kind: this.table.kind,
        thumb: this.table.thumb,
        prompt: this.table.prompt,
        model: this.table.model,
        seed: this.table.seed,
        width: this.table.width,
        height: this.table.height,
        createdAt: this.table.createdAt,
      })
      .from(this.table)
      .where(and(eq(this.table.canvasId, canvasId), eq(this.table.userId, userId)))
      .orderBy(desc(this.table.createdAt), desc(this.table.id));
    logger.debug({ durationMs: Date.now() - t0, userId, canvasId, count: rows.length }, "Image canvas items listed");
    if (rows.length === 0) return [];
    const key = await this.keys.forUser(userId);
    return rows.map((row) => ({
      ...row,
      kind: row.kind as CanvasItemKind,
      model: row.model as ComfyModelId,
      thumb: row.thumb === null ? null : decryptField(row.thumb, key),
      prompt: decryptField(row.prompt, key),
    }));
  }

  /** Число вариантов и миниатюра последнего — для строк списка холстов. */
  async variantSummaries(userId: string): Promise<CanvasVariantSummary[]> {
    const t0 = Date.now();
    const rows = await this.database.db
      .select({
        canvasId: this.table.canvasId,
        variantCount: sql<number>`count(*)::int`,
        // Миниатюра самого нового варианта холста.
        lastThumb: sql<string | null>`(array_agg(${this.table.thumb} order by ${this.table.createdAt} desc, ${this.table.id} desc))[1]`,
      })
      .from(this.table)
      .where(and(eq(this.table.userId, userId), eq(this.table.kind, "variant")))
      .groupBy(this.table.canvasId);
    logger.debug({ durationMs: Date.now() - t0, userId, canvases: rows.length }, "Image canvas variant summaries");
    if (rows.length === 0) return [];
    const key = await this.keys.forUser(userId);
    return rows.map((row) => ({ ...row, lastThumb: row.lastThumb ? decryptField(row.lastThumb, key) : null }));
  }

  async countVariants(userId: string, canvasId: number): Promise<number> {
    const rows = await this.database.db
      .select({ count: sql<number>`count(*)::int` })
      .from(this.table)
      .where(and(eq(this.table.canvasId, canvasId), eq(this.table.userId, userId), eq(this.table.kind, "variant")));
    return rows[0]?.count ?? 0;
  }

  /** Картинка элемента (data URL); undefined — нет такого. */
  async getImage(userId: string, canvasId: number, id: number): Promise<{ image: string; thumb: string | null } | undefined> {
    const t0 = Date.now();
    const rows = await this.database.db
      .select({ image: this.table.image, thumb: this.table.thumb })
      .from(this.table)
      .where(this.owned(userId, canvasId, id));
    logger.debug({ durationMs: Date.now() - t0, userId, canvasId, id, found: rows.length > 0 }, "Image canvas item image fetched");
    if (!rows[0]) return undefined;
    const key = await this.keys.forUser(userId);
    return { image: decryptField(rows[0].image, key), thumb: rows[0].thumb === null ? null : decryptField(rows[0].thumb, key) };
  }

  /**
   * Новый черновик; черновики сверх MAX_CANVAS_DRAFTS (самые старые) удаляются в той же транзакции —
   * иначе параллельная запись могла бы оставить их больше лимита.
   */
  async insertDraft(userId: string, canvasId: number, draft: NewDraft): Promise<number> {
    const t0 = Date.now();
    const key = await this.keys.forUser(userId);
    const result = await this.database.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(this.table)
        .values({
          canvasId,
          userId,
          kind: "draft",
          image: encryptField(draft.image, key),
          prompt: encryptField(draft.prompt, key),
          model: draft.model,
          seed: draft.seed,
          width: draft.width,
          height: draft.height,
        })
        .returning({ id: this.table.id });
      const drafts = await tx
        .select({ id: this.table.id })
        .from(this.table)
        .where(and(eq(this.table.canvasId, canvasId), eq(this.table.kind, "draft")))
        .orderBy(desc(this.table.createdAt), desc(this.table.id));
      const excess = drafts.slice(MAX_CANVAS_DRAFTS).map((d) => d.id);
      if (excess.length > 0) await tx.delete(this.table).where(inArray(this.table.id, excess));
      return { id: inserted[0]!.id, trimmed: excess.length };
    });
    logger.info({ durationMs: Date.now() - t0, userId, canvasId, id: result.id, trimmed: result.trimmed }, "Image canvas draft saved");
    return result.id;
  }

  /** Черновик → вариант (меняется только kind и появляется миниатюра). false — черновика нет. */
  async promoteDraft(userId: string, canvasId: number, id: number, thumb: string): Promise<boolean> {
    const t0 = Date.now();
    const key = await this.keys.forUser(userId);
    const rows = await this.database.db
      .update(this.table)
      .set({ kind: "variant", thumb: encryptField(thumb, key) })
      .where(and(this.owned(userId, canvasId, id), eq(this.table.kind, "draft")))
      .returning({ id: this.table.id });
    logger.info({ durationMs: Date.now() - t0, userId, canvasId, id, found: rows.length > 0 }, "Image canvas draft saved as variant");
    return rows.length > 0;
  }

  async delete(userId: string, canvasId: number, id: number): Promise<boolean> {
    const t0 = Date.now();
    const rows = await this.database.db.delete(this.table).where(this.owned(userId, canvasId, id)).returning({ id: this.table.id });
    logger.info({ durationMs: Date.now() - t0, userId, canvasId, id, found: rows.length > 0 }, "Image canvas item deleted");
    return rows.length > 0;
  }
}
