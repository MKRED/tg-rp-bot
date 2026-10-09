import { Controller, Delete, Get, Param, ParseIntPipe } from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import { CompactionsService } from "./compactions.service.js";

/**
 * /api/stories/:id/compactions — пересказы активной ветки. Ручное сжатие (POST /compact) пока в
 * legacy Hono: его блокировка общая с авто-сжатием внутри advance (исключение в legacyBridge.ts).
 */
@Controller("stories/:id/compactions")
export class CompactionsController {
  constructor(private readonly compactions: CompactionsService) {}

  @Get()
  async list(@CurrentUser() userId: number, @Param("id", ParseIntPipe) storyId: number) {
    return { compactions: await this.compactions.listActive(userId, storyId) };
  }

  @Delete(":cid")
  async remove(
    @CurrentUser() userId: number,
    @Param("id", ParseIntPipe) storyId: number,
    @Param("cid", ParseIntPipe) compactionId: number,
  ) {
    return { compactions: await this.compactions.remove(userId, storyId, compactionId) };
  }
}
