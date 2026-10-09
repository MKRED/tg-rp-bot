import { Controller, Delete, Get, Param, ParseIntPipe } from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import { ImpersonationsService } from "./impersonations.service.js";

/**
 * /api/chats/:id/impersonate — сохранённые варианты реплик игрока. Генерацию варианта (POST, SSE)
 * пока обслуживает legacy Hono (исключение в legacyBridge.ts).
 */
@Controller("chats/:id/impersonate")
export class ImpersonationsController {
  constructor(private readonly impersonations: ImpersonationsService) {}

  @Get()
  async list(@CurrentUser() userId: number, @Param("id", ParseIntPipe) chatId: number) {
    return { variants: await this.impersonations.list(userId, chatId) };
  }

  @Delete()
  async clear(@CurrentUser() userId: number, @Param("id", ParseIntPipe) chatId: number) {
    return { ok: true, deleted: await this.impersonations.clear(userId, chatId) };
  }

  @Delete(":variantId")
  async remove(
    @CurrentUser() userId: number,
    @Param("id", ParseIntPipe) chatId: number,
    @Param("variantId", ParseIntPipe) variantId: number,
  ) {
    await this.impersonations.remove(userId, chatId, variantId);
    return { ok: true };
  }
}
