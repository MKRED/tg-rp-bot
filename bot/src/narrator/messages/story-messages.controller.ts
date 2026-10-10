import { Body, Controller, Delete, HttpCode, Param, ParseIntPipe, Post } from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import { EditStoryBeatDto } from "./dto/edit-story-beat.dto.js";
import { StoryMessagesService } from "./story-messages.service.js";

/**
 * /api/stories/:id/messages — действия над сообщениями вне генерации (регенерация бита — в
 * StoryGenerationController).
 */
@Controller("stories/:id/messages")
export class StoryMessagesController {
  constructor(private readonly messages: StoryMessagesService) {}

  @Post(":msgId/branch")
  @HttpCode(200)
  async switchBranch(
    @CurrentUser() userId: string,
    @Param("id", ParseIntPipe) storyId: number,
    @Param("msgId", ParseIntPipe) msgId: number,
  ) {
    await this.messages.switchBranch(userId, storyId, msgId);
    return { ok: true };
  }

  @Post(":msgId/edit")
  @HttpCode(200)
  editBeat(
    @CurrentUser() userId: string,
    @Param("id", ParseIntPipe) storyId: number,
    @Param("msgId", ParseIntPipe) msgId: number,
    @Body() { content }: EditStoryBeatDto,
  ) {
    return this.messages.editBeat(userId, storyId, msgId, content);
  }

  @Delete(":msgId")
  async remove(
    @CurrentUser() userId: string,
    @Param("id", ParseIntPipe) storyId: number,
    @Param("msgId", ParseIntPipe) msgId: number,
  ) {
    await this.messages.remove(userId, storyId, msgId);
    return { ok: true };
  }
}
