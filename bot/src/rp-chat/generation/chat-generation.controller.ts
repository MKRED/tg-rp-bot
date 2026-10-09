import { Body, Controller, HttpCode, Param, ParseIntPipe, RequestMethod, Sse } from "@nestjs/common";
import { METHOD_METADATA } from "@nestjs/common/constants.js";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import { ChatGenerationService } from "./chat-generation.service.js";
import { SendMessageDto } from "./dto/send-message.dto.js";
import { ImpersonateGenerationService } from "./impersonate-generation.service.js";

/**
 * Штатный @Sse на POST (Nest 12 принимает метод вторым аргументом): webapp стримит через POST + fetch,
 * тело несёт текст реплики. POST по умолчанию ответил бы 201 — Hono-версия отвечала 200.
 */
const POST = { [METHOD_METADATA]: RequestMethod.POST };

/** Стриминговая генерация RP-чата (SSE): ответ ИИ на отправку/правку/перегенерацию и вариант impersonate. */
@Controller("chats/:id")
export class ChatGenerationController {
  constructor(
    private readonly generation: ChatGenerationService,
    private readonly impersonate: ImpersonateGenerationService,
  ) {}

  @Sse("messages", POST)
  @HttpCode(200)
  send(@CurrentUser() userId: number, @Param("id", ParseIntPipe) chatId: number, @Body() { content }: SendMessageDto) {
    return this.generation.send(userId, chatId, content);
  }

  @Sse("messages/:msgId/edit", POST)
  @HttpCode(200)
  edit(
    @CurrentUser() userId: number,
    @Param("id", ParseIntPipe) chatId: number,
    @Param("msgId", ParseIntPipe) msgId: number,
    @Body() { content }: SendMessageDto,
  ) {
    return this.generation.edit(userId, chatId, msgId, content);
  }

  @Sse("messages/:msgId/regenerate", POST)
  @HttpCode(200)
  regenerate(@CurrentUser() userId: number, @Param("id", ParseIntPipe) chatId: number, @Param("msgId", ParseIntPipe) msgId: number) {
    return this.generation.regenerate(userId, chatId, msgId);
  }

  @Sse("impersonate", POST)
  @HttpCode(200)
  generateImpersonation(@CurrentUser() userId: number, @Param("id", ParseIntPipe) chatId: number) {
    return this.impersonate.generate(userId, chatId);
  }
}
