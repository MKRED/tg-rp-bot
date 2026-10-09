import { Body, Controller, Get, Param, ParseIntPipe, Put } from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import { ChatSettingsService } from "./chat-settings.service.js";
import { UpdateChatSettingsDto } from "./dto/update-chat-settings.dto.js";

/** /api/chats/:id/settings — настройки перевода чата. */
@Controller("chats/:id/settings")
export class ChatSettingsController {
  constructor(private readonly settings: ChatSettingsService) {}

  @Get()
  async get(@CurrentUser() userId: number, @Param("id", ParseIntPipe) chatId: number) {
    return { settings: await this.settings.get(userId, chatId) };
  }

  @Put()
  async update(@CurrentUser() userId: number, @Param("id", ParseIntPipe) chatId: number, @Body() dto: UpdateChatSettingsDto) {
    return { settings: await this.settings.update(userId, chatId, dto) };
  }
}
