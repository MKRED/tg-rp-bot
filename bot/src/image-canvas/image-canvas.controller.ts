import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Put } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator.js";
import {
  CanvasReferenceDto,
  CreateImageCanvasDto,
  ImageCanvasPatchDto,
  ReorderCanvasReferencesDto,
  SaveCanvasDraftDto,
} from "./dto/image-canvas.dto.js";
import { ImageCanvasService } from "./image-canvas.service.js";

/**
 * /api/image-canvases — раздел «Картинки». Состояние холста приходит без полных картинок: их webapp
 * берёт отдельными запросами (references/:slot, items/:itemId/image) через apiFetch — в Mini App
 * авторизация в заголовке, и <img src="/api/..."> не прошёл бы.
 */
@Controller("image-canvases")
export class ImageCanvasController {
  constructor(private readonly canvases: ImageCanvasService) {}

  @Get()
  list(@CurrentUser() userId: string) {
    return this.canvases.list(userId);
  }

  @Post()
  create(@CurrentUser() userId: string, @Body() body: CreateImageCanvasDto) {
    return this.canvases.create(userId, body.name);
  }

  @Get(":id")
  get(@CurrentUser() userId: string, @Param("id", ParseIntPipe) id: number) {
    return this.canvases.get(userId, id);
  }

  @Patch(":id")
  update(@CurrentUser() userId: string, @Param("id", ParseIntPipe) id: number, @Body() patch: ImageCanvasPatchDto) {
    return this.canvases.update(userId, id, patch);
  }

  @Delete(":id")
  remove(@CurrentUser() userId: string, @Param("id", ParseIntPipe) id: number) {
    return this.canvases.delete(userId, id);
  }

  // Объявлен до :slot-маршрутов: иначе "order" ушло бы в ParseIntPipe слота и дало 400.
  @Put(":id/references/order")
  reorderReferences(@CurrentUser() userId: string, @Param("id", ParseIntPipe) id: number, @Body() body: ReorderCanvasReferencesDto) {
    return this.canvases.reorderReferences(userId, id, body.order);
  }

  @Get(":id/references/:slot")
  getReference(@CurrentUser() userId: string, @Param("id", ParseIntPipe) id: number, @Param("slot", ParseIntPipe) slot: number) {
    return this.canvases.getReference(userId, id, slot);
  }

  @Put(":id/references/:slot")
  setReference(
    @CurrentUser() userId: string,
    @Param("id", ParseIntPipe) id: number,
    @Param("slot", ParseIntPipe) slot: number,
    @Body() body: CanvasReferenceDto,
  ) {
    return this.canvases.setReference(userId, id, slot, body);
  }

  @Delete(":id/references/:slot")
  removeReference(@CurrentUser() userId: string, @Param("id", ParseIntPipe) id: number, @Param("slot", ParseIntPipe) slot: number) {
    return this.canvases.removeReference(userId, id, slot);
  }

  @Post(":id/generate")
  @HttpCode(200)
  generate(@CurrentUser() userId: string, @Param("id", ParseIntPipe) id: number) {
    return this.canvases.generate(userId, id);
  }

  @Post(":id/cancel")
  @HttpCode(200)
  cancel(@CurrentUser() userId: string, @Param("id", ParseIntPipe) id: number) {
    return this.canvases.cancel(userId, id);
  }

  @Get(":id/items/:itemId/image")
  itemImage(@CurrentUser() userId: string, @Param("id", ParseIntPipe) id: number, @Param("itemId", ParseIntPipe) itemId: number) {
    return this.canvases.itemImage(userId, id, itemId);
  }

  @Post(":id/items/:itemId/save")
  @HttpCode(200)
  saveDraft(
    @CurrentUser() userId: string,
    @Param("id", ParseIntPipe) id: number,
    @Param("itemId", ParseIntPipe) itemId: number,
    @Body() body: SaveCanvasDraftDto,
  ) {
    return this.canvases.saveDraft(userId, id, itemId, body.thumb);
  }

  /** «В работу»: вариант становится картинкой 1. */
  @Post(":id/items/:itemId/use")
  @HttpCode(200)
  useVariant(@CurrentUser() userId: string, @Param("id", ParseIntPipe) id: number, @Param("itemId", ParseIntPipe) itemId: number) {
    return this.canvases.useVariant(userId, id, itemId);
  }

  @Delete(":id/items/:itemId")
  deleteItem(@CurrentUser() userId: string, @Param("id", ParseIntPipe) id: number, @Param("itemId", ParseIntPipe) itemId: number) {
    return this.canvases.deleteItem(userId, id, itemId);
  }
}
