import { Body, Controller, Get, Param, ParseIntPipe, Put } from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import { UpdateStorySettingsDto } from "./dto/update-story-settings.dto.js";
import { StorySettingsService } from "./story-settings.service.js";

/** /api/stories/:id/settings — настройки истории (перевод, сжатие, тулбар сообщения). */
@Controller("stories/:id/settings")
export class StorySettingsController {
  constructor(private readonly settings: StorySettingsService) {}

  @Get()
  async get(@CurrentUser() userId: string, @Param("id", ParseIntPipe) storyId: number) {
    return { settings: await this.settings.get(userId, storyId) };
  }

  @Put()
  async update(@CurrentUser() userId: string, @Param("id", ParseIntPipe) storyId: number, @Body() dto: UpdateStorySettingsDto) {
    return { settings: await this.settings.update(userId, storyId, dto) };
  }
}
