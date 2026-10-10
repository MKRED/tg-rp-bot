import { Body, Controller, Delete, HttpCode, Param, ParseIntPipe, Post, Query } from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import { ChatTranslationService } from "./chat-translation.service.js";
import { DeleteTranslationQueryDto } from "../../translate/dto/delete-translation-query.dto.js";
import { MessageTranslateTextDto } from "../../translate/dto/message-translate-text.dto.js";
import { TranslateMessageDto } from "../../translate/dto/translate-message.dto.js";

/** Перевод в RP-чате: сообщение (с кэшем), удаление кэша для языка, эфемерный перевод текста. */
@Controller("chats/:id")
export class ChatTranslationController {
  constructor(private readonly translation: ChatTranslationService) {}

  @Post("messages/:msgId/translate")
  @HttpCode(200)
  async translateMessage(
    @CurrentUser() userId: string,
    @Param("id", ParseIntPipe) chatId: number,
    @Param("msgId", ParseIntPipe) msgId: number,
    @Body() dto: TranslateMessageDto,
  ) {
    return { translation: await this.translation.translateMessage(userId, chatId, msgId, dto) };
  }

  @Delete("messages/:msgId/translate")
  async deleteTranslation(
    @CurrentUser() userId: string,
    @Param("id", ParseIntPipe) chatId: number,
    @Param("msgId", ParseIntPipe) msgId: number,
    @Query() { lang }: DeleteTranslationQueryDto,
  ) {
    await this.translation.deleteTranslation(userId, chatId, msgId, lang);
    return { ok: true };
  }

  @Post("translate-text")
  @HttpCode(200)
  async translateText(@CurrentUser() userId: string, @Param("id", ParseIntPipe) chatId: number, @Body() dto: MessageTranslateTextDto) {
    return { translation: await this.translation.translateText(userId, chatId, dto) };
  }
}
