import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import { ChatsService } from "./chats.service.js";
import { CreateChatDto } from "./dto/create-chat.dto.js";
import { ListChatsQueryDto } from "./dto/list-chats-query.dto.js";
import { RenameChatDto } from "./dto/rename-chat.dto.js";

/** /api/chats — список, создание, чат с активным путём, переименование, удаление, граф веток. */
@Controller("chats")
export class ChatsController {
  constructor(private readonly chats: ChatsService) {}

  @Get()
  async list(@CurrentUser() userId: number, @Query() { page, pageSize }: ListChatsQueryDto) {
    const { items, total } = await this.chats.list(userId, page, pageSize);
    return { items, total, page, pageSize };
  }

  @Post()
  async create(@CurrentUser() userId: number, @Body() input: CreateChatDto) {
    const chat = await this.chats.create(userId, input);
    return { chat: { id: chat.id } };
  }

  @Get(":id")
  async get(@CurrentUser() userId: number, @Param("id", ParseIntPipe) chatId: number) {
    return { chat: await this.chats.get(userId, chatId) };
  }

  @Patch(":id")
  async rename(@CurrentUser() userId: number, @Param("id", ParseIntPipe) chatId: number, @Body() { title }: RenameChatDto) {
    return { title: await this.chats.rename(userId, chatId, title) };
  }

  @Delete(":id")
  async remove(@CurrentUser() userId: number, @Param("id", ParseIntPipe) chatId: number) {
    await this.chats.remove(userId, chatId);
    return { ok: true };
  }

  @Get(":id/tree")
  async tree(@CurrentUser() userId: number, @Param("id", ParseIntPipe) chatId: number) {
    return { nodes: await this.chats.tree(userId, chatId) };
  }
}
