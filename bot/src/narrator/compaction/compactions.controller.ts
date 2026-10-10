import { Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post } from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import { CompactionsService } from "./compactions.service.js";
import { StoryCompactionService } from "./story-compaction.service.js";

/** Сжатие истории: ручной проход (POST /compact) и пересказы активной ветки (список, удаление). */
@Controller("stories/:id")
export class CompactionsController {
  constructor(
    private readonly compactions: CompactionsService,
    private readonly compaction: StoryCompactionService,
  ) {}

  /** Один проход сжатия; ответ — число созданных пересказов и обновлённый список. */
  @Post("compact")
  @HttpCode(200)
  async compact(@CurrentUser() userId: string, @Param("id", ParseIntPipe) storyId: number) {
    const created = await this.compaction.compact(userId, storyId);
    return { created, compactions: await this.compactions.listActive(userId, storyId) };
  }

  @Get("compactions")
  async list(@CurrentUser() userId: string, @Param("id", ParseIntPipe) storyId: number) {
    return { compactions: await this.compactions.listActive(userId, storyId) };
  }

  @Delete("compactions/:cid")
  async remove(
    @CurrentUser() userId: string,
    @Param("id", ParseIntPipe) storyId: number,
    @Param("cid", ParseIntPipe) compactionId: number,
  ) {
    return { compactions: await this.compactions.remove(userId, storyId, compactionId) };
  }
}
