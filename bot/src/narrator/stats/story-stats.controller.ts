import { Controller, Get, Param, ParseIntPipe } from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import { StoryStatsService } from "./story-stats.service.js";

/** /api/stories/:id/stats — статистика истории для экрана настроек. */
@Controller("stories/:id/stats")
export class StoryStatsController {
  constructor(private readonly stats: StoryStatsService) {}

  @Get()
  async get(@CurrentUser() userId: string, @Param("id", ParseIntPipe) storyId: number) {
    return { stats: await this.stats.get(userId, storyId) };
  }
}
