import { Controller, Get, Param, ParseIntPipe } from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import { ChatStatsService } from "./chat-stats.service.js";

/** /api/chats/:id/stats — статистика чата для экрана настроек. */
@Controller("chats/:id/stats")
export class ChatStatsController {
  constructor(private readonly stats: ChatStatsService) {}

  @Get()
  async get(@CurrentUser() userId: string, @Param("id", ParseIntPipe) chatId: number) {
    return { stats: await this.stats.get(userId, chatId) };
  }
}
