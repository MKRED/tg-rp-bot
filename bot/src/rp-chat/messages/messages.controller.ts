import { Controller, Delete, HttpCode, Param, ParseIntPipe, Post } from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import { MessagesService } from "./messages.service.js";

/**
 * /api/chats/:id/messages — действия над сообщениями вне генерации. Стриминговые send/edit/regenerate —
 * в generation/.
 */
@Controller("chats/:id/messages")
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Post(":msgId/branch")
  @HttpCode(200)
  async switchBranch(
    @CurrentUser() userId: number,
    @Param("id", ParseIntPipe) chatId: number,
    @Param("msgId", ParseIntPipe) msgId: number,
  ) {
    await this.messages.switchBranch(userId, chatId, msgId);
    return { ok: true };
  }

  @Delete(":msgId")
  async remove(
    @CurrentUser() userId: number,
    @Param("id", ParseIntPipe) chatId: number,
    @Param("msgId", ParseIntPipe) msgId: number,
  ) {
    await this.messages.remove(userId, chatId, msgId);
    return { ok: true };
  }
}
