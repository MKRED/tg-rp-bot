import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  MAX_CANVAS_REFERENCES,
  MAX_CANVAS_VARIANTS,
  MAX_IMAGE_CANVASES_PER_USER,
  type CanvasImageResponse,
  type CanvasReferenceInput,
  type ImageCanvas,
  type ImageCanvasListItem,
  type ImageCanvasPatch,
} from "@tg-rp-bot/shared";
import logger from "../logger.js";
import { CanvasGenerationService } from "./generation/canvas-generation.service.js";
import { ImageCanvasItemsRepository } from "./image-canvas-items.repository.js";
import { ImageCanvasRepository, type CanvasRecord } from "./image-canvas.repository.js";
import { toCanvasView, toListView } from "./view.js";

const DEFAULT_NAME = "Новый холст";

/** Холсты раздела «Картинки»: правила лимитов, картинки по слотам, черновики и варианты. */
@Injectable()
export class ImageCanvasService {
  constructor(
    private readonly canvases: ImageCanvasRepository,
    private readonly items: ImageCanvasItemsRepository,
    private readonly generation: CanvasGenerationService,
  ) {}

  async list(userId: string): Promise<ImageCanvasListItem[]> {
    const [rows, summaries] = await Promise.all([this.canvases.list(userId), this.items.variantSummaries(userId)]);
    return toListView(rows, summaries);
  }

  async create(userId: string, name?: string): Promise<ImageCanvas> {
    if ((await this.canvases.count(userId)) >= MAX_IMAGE_CANVASES_PER_USER) {
      throw new ConflictException(`Достигнут лимит в ${MAX_IMAGE_CANVASES_PER_USER} холстов — удалите ненужный`);
    }
    const canvas = await this.canvases.create(userId, name?.trim() || DEFAULT_NAME);
    return toCanvasView(canvas, []);
  }

  async get(userId: string, id: number): Promise<ImageCanvas> {
    return this.view(userId, await this.require(userId, id));
  }

  async update(userId: string, id: number, patch: ImageCanvasPatch): Promise<ImageCanvas> {
    const name = patch.name?.trim();
    if (patch.name !== undefined && !name) throw new BadRequestException("Название не может быть пустым");
    const updated = await this.canvases.update(userId, id, { ...patch, ...(name !== undefined && { name }) });
    if (!updated) throw new NotFoundException("Холст не найден");
    return this.view(userId, updated);
  }

  async delete(userId: string, id: number): Promise<{ ok: true }> {
    const canvas = await this.require(userId, id);
    // Идущее задание убираем из ComfyUI, чтобы ПК не считал картинку для удалённого холста.
    await this.generation.cancel(userId, canvas);
    await this.canvases.delete(userId, id);
    return { ok: true };
  }

  /** Картинка в слот: slot < числа картинок — замена, slot = числу — добавление в конец. */
  async setReference(userId: string, id: number, slot: number, input: CanvasReferenceInput): Promise<ImageCanvas> {
    const canvas = await this.require(userId, id);
    const references = await this.references(userId, id);
    const thumbs = [...canvas.referenceThumbs];
    if (slot > references.length || slot >= MAX_CANVAS_REFERENCES) {
      throw new BadRequestException(`Можно прикрепить не больше ${MAX_CANVAS_REFERENCES} картинок`);
    }
    references[slot] = input.image;
    thumbs[slot] = input.thumb;
    return this.saveReferences(userId, id, references, thumbs);
  }

  /** Убрать картинку: следующие сдвигаются (<image3> становится <image2>). */
  async removeReference(userId: string, id: number, slot: number): Promise<ImageCanvas> {
    const canvas = await this.require(userId, id);
    const references = await this.references(userId, id);
    if (slot >= references.length) throw new NotFoundException("Картинки нет");
    return this.saveReferences(
      userId,
      id,
      references.filter((_, i) => i !== slot),
      canvas.referenceThumbs.filter((_, i) => i !== slot),
    );
  }

  /** Переставить картинки (order[i] — прежний слот новой i-й). Теги в промпте не трогаем — так решил пользователь. */
  async reorderReferences(userId: string, id: number, order: number[]): Promise<ImageCanvas> {
    const canvas = await this.require(userId, id);
    const references = await this.references(userId, id);
    if (!isPermutation(order, references.length)) {
      throw new BadRequestException("Порядок картинок устарел — обновите холст");
    }
    return this.saveReferences(
      userId,
      id,
      order.map((from) => references[from]!),
      order.map((from) => canvas.referenceThumbs[from]!),
    );
  }

  async getReference(userId: string, id: number, slot: number): Promise<CanvasImageResponse> {
    const image = (await this.references(userId, id))[slot];
    if (!image) throw new NotFoundException("Картинки нет");
    return { image };
  }

  /** «В работу»: сохранённый вариант становится картинкой 1 (заменяет её или встаёт первой). */
  async useVariant(userId: string, id: number, itemId: number): Promise<ImageCanvas> {
    const canvas = await this.require(userId, id);
    const item = await this.items.getImage(userId, id, itemId);
    if (!item?.thumb) throw new NotFoundException("Вариант не найден");
    const references = await this.references(userId, id);
    const thumbs = [...canvas.referenceThumbs];
    references[0] = item.image;
    thumbs[0] = item.thumb;
    return this.saveReferences(userId, id, references, thumbs);
  }

  async generate(userId: string, id: number): Promise<ImageCanvas> {
    const canvas = await this.require(userId, id);
    await this.generation.start(userId, canvas, await this.references(userId, id));
    return this.get(userId, id);
  }

  async cancel(userId: string, id: number): Promise<ImageCanvas> {
    await this.generation.cancel(userId, await this.require(userId, id));
    return this.get(userId, id);
  }

  async itemImage(userId: string, id: number, itemId: number): Promise<CanvasImageResponse> {
    const item = await this.items.getImage(userId, id, itemId);
    if (!item) throw new NotFoundException("Картинка не найдена");
    return { image: item.image };
  }

  /** Черновик → вариант. Миниатюру готовит webapp: у него уже есть открытая картинка. */
  async saveDraft(userId: string, id: number, itemId: number, thumb: string): Promise<ImageCanvas> {
    await this.require(userId, id);
    if ((await this.items.countVariants(userId, id)) >= MAX_CANVAS_VARIANTS) {
      throw new ConflictException(`В холсте уже ${MAX_CANVAS_VARIANTS} вариантов — удалите ненужные в галерее`);
    }
    if (!(await this.items.promoteDraft(userId, id, itemId, thumb))) throw new NotFoundException("Черновик не найден");
    await this.canvases.touch(userId, id);
    return this.get(userId, id);
  }

  /** Отбросить черновик или удалить вариант. */
  async deleteItem(userId: string, id: number, itemId: number): Promise<ImageCanvas> {
    await this.require(userId, id);
    if (!(await this.items.delete(userId, id, itemId))) throw new NotFoundException("Картинка не найдена");
    return this.get(userId, id);
  }

  private async require(userId: string, id: number): Promise<CanvasRecord> {
    const canvas = await this.canvases.find(userId, id);
    if (!canvas) throw new NotFoundException("Холст не найден");
    return canvas;
  }

  private async references(userId: string, id: number): Promise<string[]> {
    const references = await this.canvases.findReferences(userId, id);
    if (!references) throw new NotFoundException("Холст не найден");
    return references;
  }

  private async saveReferences(userId: string, id: number, references: string[], thumbs: string[]): Promise<ImageCanvas> {
    const updated = await this.canvases.setReferences(userId, id, references, thumbs);
    if (!updated) throw new NotFoundException("Холст не найден");
    logger.debug({ userId, id, count: references.length }, "Image canvas references changed");
    return this.view(userId, updated);
  }

  private async view(userId: string, canvas: CanvasRecord): Promise<ImageCanvas> {
    return toCanvasView(canvas, await this.items.list(userId, canvas.id));
  }
}

/** order — перестановка 0..length-1 (каждый слот ровно один раз). */
export function isPermutation(order: number[], length: number): boolean {
  if (order.length !== length) return false;
  const seen = new Set(order);
  return seen.size === length && order.every((n) => Number.isInteger(n) && n >= 0 && n < length);
}
