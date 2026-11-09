import { Injectable } from "@nestjs/common";
import type { ComfyModelId } from "@tg-rp-bot/shared";
import { and, desc, eq, sql } from "drizzle-orm";
import { DatabaseService } from "../database/database.service.js";
import { schema } from "../db/index.js";
import type { ImageCanvasRow } from "../db/schema.js";
import logger from "../logger.js";
import { UserKeysService } from "../user-keys/user-keys.service.js";
import { decryptField, encryptField } from "../utils/index.js";

/** Параметры текущей генерации, нужные, чтобы записать её результат черновиком. */
export interface GenerationRequest {
  model: ComfyModelId;
  prompt: string;
  seed: number;
}

/** Холст без самих картинок (их грузит findReferences): prompt и миниатюры расшифрованы. */
export interface CanvasRecord {
  id: number;
  userId: string;
  name: string;
  model: ComfyModelId;
  prompt: string;
  referenceThumbs: string[];
  genStatus: "idle" | "running" | "error";
  genPromptId: string | null;
  genStartedAt: Date | null;
  genError: string | null;
  genRequest: GenerationRequest | null;
  updatedAt: Date;
}

export interface CanvasListRow {
  id: number;
  name: string;
  model: ComfyModelId;
  genStatus: string;
  firstReferenceThumb: string | null;
  updatedAt: Date;
}

export interface GenerationState {
  genStatus: "idle" | "running" | "error";
  genPromptId: string | null;
  genStartedAt: Date | null;
  genError: string | null;
  genRequest: GenerationRequest | null;
}

/** Все колонки, кроме тяжёлых references: их читаем отдельно и только когда нужны. */
const CANVAS_COLUMNS = {
  id: schema.imageCanvases.id,
  userId: schema.imageCanvases.userId,
  name: schema.imageCanvases.name,
  model: schema.imageCanvases.model,
  prompt: schema.imageCanvases.prompt,
  referenceThumbs: schema.imageCanvases.referenceThumbs,
  genStatus: schema.imageCanvases.genStatus,
  genPromptId: schema.imageCanvases.genPromptId,
  genStartedAt: schema.imageCanvases.genStartedAt,
  genError: schema.imageCanvases.genError,
  genRequest: schema.imageCanvases.genRequest,
  updatedAt: schema.imageCanvases.updatedAt,
};

type CanvasColumnsRow = Pick<ImageCanvasRow, keyof typeof CANVAS_COLUMNS>;

/**
 * Таблица image_canvases. Все запросы ограничены владельцем (кроме findRunning — для возобновления
 * генераций после перезапуска). prompt, картинки, миниатюры и параметры генерации шифруются per-user.
 */
@Injectable()
export class ImageCanvasRepository {
  constructor(
    private readonly database: DatabaseService,
    private readonly keys: UserKeysService,
  ) {}

  private get table() {
    return schema.imageCanvases;
  }

  private owned(userId: string, id: number) {
    return and(eq(this.table.id, id), eq(this.table.userId, userId));
  }

  async list(userId: string): Promise<CanvasListRow[]> {
    const t0 = Date.now();
    const rows = await this.database.db
      .select({
        id: this.table.id,
        name: this.table.name,
        model: this.table.model,
        genStatus: this.table.genStatus,
        // Только первая миниатюра — для строки списка, без остальных.
        firstThumb: sql<string | null>`${this.table.referenceThumbs}->>0`,
        updatedAt: this.table.updatedAt,
      })
      .from(this.table)
      .where(eq(this.table.userId, userId))
      .orderBy(desc(this.table.updatedAt));
    const key = rows.length > 0 ? await this.keys.forUser(userId) : null;
    logger.debug({ durationMs: Date.now() - t0, userId, count: rows.length }, "Image canvases listed");
    return rows.map(({ firstThumb, model, ...row }) => ({
      ...row,
      model: model as ComfyModelId,
      firstReferenceThumb: firstThumb && key ? decryptField(firstThumb, key) : null,
    }));
  }

  async count(userId: string): Promise<number> {
    const rows = await this.database.db
      .select({ count: sql<number>`count(*)::int` })
      .from(this.table)
      .where(eq(this.table.userId, userId));
    return rows[0]?.count ?? 0;
  }

  async create(userId: string, name: string): Promise<CanvasRecord> {
    const t0 = Date.now();
    const rows = await this.database.db.insert(this.table).values({ userId, name }).returning(CANVAS_COLUMNS);
    logger.info({ durationMs: Date.now() - t0, userId, id: rows[0]!.id }, "Image canvas created");
    return this.decrypt(rows[0]!, await this.keys.forUser(userId));
  }

  async find(userId: string, id: number): Promise<CanvasRecord | undefined> {
    const t0 = Date.now();
    const rows = await this.database.db.select(CANVAS_COLUMNS).from(this.table).where(this.owned(userId, id));
    logger.debug({ durationMs: Date.now() - t0, userId, id, found: rows.length > 0 }, "Image canvas fetched");
    return rows[0] ? this.decrypt(rows[0], await this.keys.forUser(userId)) : undefined;
  }

  /** Полные картинки холста (data URL) по порядку; undefined — холста нет. */
  async findReferences(userId: string, id: number): Promise<string[] | undefined> {
    const t0 = Date.now();
    const rows = await this.database.db
      .select({ references: this.table.references })
      .from(this.table)
      .where(this.owned(userId, id));
    logger.debug({ durationMs: Date.now() - t0, userId, id, found: rows.length > 0 }, "Image canvas references fetched");
    if (!rows[0]) return undefined;
    const key = await this.keys.forUser(userId);
    return rows[0].references.map((image) => decryptField(image, key));
  }

  async update(
    userId: string,
    id: number,
    patch: { name?: string; model?: ComfyModelId; prompt?: string },
  ): Promise<CanvasRecord | undefined> {
    const t0 = Date.now();
    const key = await this.keys.forUser(userId);
    const rows = await this.database.db
      .update(this.table)
      .set({
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.model !== undefined && { model: patch.model }),
        ...(patch.prompt !== undefined && { prompt: encryptField(patch.prompt, key) }),
      })
      .where(this.owned(userId, id))
      .returning(CANVAS_COLUMNS);
    logger.info({ durationMs: Date.now() - t0, userId, id, fields: Object.keys(patch) }, "Image canvas updated");
    return rows[0] ? this.decrypt(rows[0], key) : undefined;
  }

  async setReferences(userId: string, id: number, references: string[], thumbs: string[]): Promise<CanvasRecord | undefined> {
    const t0 = Date.now();
    const key = await this.keys.forUser(userId);
    const rows = await this.database.db
      .update(this.table)
      .set({
        references: references.map((image) => encryptField(image, key)),
        referenceThumbs: thumbs.map((thumb) => encryptField(thumb, key)),
      })
      .where(this.owned(userId, id))
      .returning(CANVAS_COLUMNS);
    logger.info({ durationMs: Date.now() - t0, userId, id, count: references.length }, "Image canvas references saved");
    return rows[0] ? this.decrypt(rows[0], key) : undefined;
  }

  async setGeneration(userId: string, id: number, state: GenerationState): Promise<void> {
    const t0 = Date.now();
    const key = await this.keys.forUser(userId);
    await this.database.db
      .update(this.table)
      .set({
        genStatus: state.genStatus,
        genPromptId: state.genPromptId,
        genStartedAt: state.genStartedAt,
        genError: state.genError,
        genRequest: state.genRequest ? encryptField(JSON.stringify(state.genRequest), key) : null,
      })
      .where(this.owned(userId, id));
    logger.info({ durationMs: Date.now() - t0, userId, id, status: state.genStatus }, "Image canvas generation state saved");
  }

  /** Холсты с идущей генерацией у всех пользователей — следить за ними после перезапуска бота. */
  async findRunning(): Promise<CanvasRecord[]> {
    const t0 = Date.now();
    const rows = await this.database.db.select(CANVAS_COLUMNS).from(this.table).where(eq(this.table.genStatus, "running"));
    logger.info({ durationMs: Date.now() - t0, count: rows.length }, "Running image canvas generations found");
    return Promise.all(rows.map(async (row) => this.decrypt(row, await this.keys.forUser(row.userId))));
  }

  async delete(userId: string, id: number): Promise<boolean> {
    const t0 = Date.now();
    const rows = await this.database.db.delete(this.table).where(this.owned(userId, id)).returning({ id: this.table.id });
    logger.info({ durationMs: Date.now() - t0, userId, id, found: rows.length > 0 }, "Image canvas deleted");
    return rows.length > 0;
  }

  /** Отметить холст изменённым (поднять в списке) — после нового черновика или варианта. */
  async touch(userId: string, id: number): Promise<void> {
    await this.database.db.update(this.table).set({ updatedAt: new Date() }).where(this.owned(userId, id));
  }

  private decrypt(row: CanvasColumnsRow, key: Buffer): CanvasRecord {
    return {
      ...row,
      model: row.model as ComfyModelId,
      prompt: decryptField(row.prompt, key),
      referenceThumbs: row.referenceThumbs.map((thumb) => decryptField(thumb, key)),
      genStatus: row.genStatus as CanvasRecord["genStatus"],
      genRequest: row.genRequest ? (JSON.parse(decryptField(row.genRequest, key)) as GenerationRequest) : null,
    };
  }
}
