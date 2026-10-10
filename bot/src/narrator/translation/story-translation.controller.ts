import { Body, Controller, Delete, HttpCode, Param, ParseIntPipe, Post, Query } from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import { DeleteTranslationQueryDto } from "../../translate/dto/delete-translation-query.dto.js";
import { MessageTranslateTextDto } from "../../translate/dto/message-translate-text.dto.js";
import { TranslateMessageDto } from "../../translate/dto/translate-message.dto.js";
import { StoryTranslationService } from "./story-translation.service.js";

/** Перевод в истории: бит/директива (с кэшем), удаление кэша для языка, эфемерный перевод черновика. */
@Controller("stories/:id")
export class StoryTranslationController {
  constructor(private readonly translation: StoryTranslationService) {}

  @Post("messages/:msgId/translate")
  @HttpCode(200)
  async translateMessage(
    @CurrentUser() userId: string,
    @Param("id", ParseIntPipe) storyId: number,
    @Param("msgId", ParseIntPipe) msgId: number,
    @Body() dto: TranslateMessageDto,
  ) {
    return { translation: await this.translation.translateMessage(userId, storyId, msgId, dto) };
  }

  @Delete("messages/:msgId/translate")
  async deleteTranslation(
    @CurrentUser() userId: string,
    @Param("id", ParseIntPipe) storyId: number,
    @Param("msgId", ParseIntPipe) msgId: number,
    @Query() { lang }: DeleteTranslationQueryDto,
  ) {
    await this.translation.deleteTranslation(userId, storyId, msgId, lang);
    return { ok: true };
  }

  @Post("translate-text")
  @HttpCode(200)
  async translateText(@CurrentUser() userId: string, @Param("id", ParseIntPipe) storyId: number, @Body() dto: MessageTranslateTextDto) {
    return { translation: await this.translation.translateText(userId, storyId, dto) };
  }
}
