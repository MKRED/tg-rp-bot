import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { CoauthorTurnService } from "./coauthor-turn.service.js";
import { CoauthorService } from "./coauthor.service.js";
import { CoauthorAnswerDto, CoauthorMessageDto, CoauthorReviewDto } from "./dto/coauthor-actions.dto.js";
import { CoauthorChatInputDto } from "./dto/coauthor-chat-input.dto.js";

/**
 * /api/coauthor — чаты «Соавтора». Все действия отвечают полным чатом `{ chat }`: лента, правки и
 * карточки меняются вместе, точечный мерж на клиенте того не стоит. Действия — POST с 200 (ничего не создают).
 */
@Controller("coauthor")
export class CoauthorController {
  constructor(
    private readonly chats: CoauthorService,
    private readonly turns: CoauthorTurnService,
  ) {}

  @Get()
  async list(@CurrentUser() userId: string) {
    return { chats: await this.chats.list(userId) };
  }

  @Get(":id")
  async get(@CurrentUser() userId: string, @Param("id", ParseIntPipe) id: number) {
    return { chat: await this.chats.get(userId, id) };
  }

  @Post()
  async create(@CurrentUser() userId: string, @Body() input: CoauthorChatInputDto) {
    return { chat: await this.chats.create(userId, input) };
  }

  @Put(":id")
  async update(@CurrentUser() userId: string, @Param("id", ParseIntPipe) id: number, @Body() input: CoauthorChatInputDto) {
    return { chat: await this.chats.update(userId, id, input) };
  }

  @Delete(":id")
  async remove(@CurrentUser() userId: string, @Param("id", ParseIntPipe) id: number) {
    await this.chats.remove(userId, id);
    return { ok: true };
  }

  /** Сообщение пользователя → ход ИИ (десятки секунд). */
  @Post(":id/messages")
  @HttpCode(200)
  async send(@CurrentUser() userId: string, @Param("id", ParseIntPipe) id: number, @Body() body: CoauthorMessageDto) {
    return { chat: await this.turns.send(userId, id, body.text) };
  }

  /** Ответ на вопросы ИИ — ход продолжается. */
  @Post(":id/answer")
  @HttpCode(200)
  async answer(@CurrentUser() userId: string, @Param("id", ParseIntPipe) id: number, @Body() body: CoauthorAnswerDto) {
    const input = body.skipped
      ? { skipped: true as const, note: body.note }
      : { skipped: false as const, answers: body.answers ?? [], note: body.note };
    return { chat: await this.turns.answer(userId, id, input) };
  }

  /** Принять или отклонить правки; ответ — `{ chat, stale }`. */
  @Post(":id/review")
  @HttpCode(200)
  review(@CurrentUser() userId: string, @Param("id", ParseIntPipe) id: number, @Body() body: CoauthorReviewDto) {
    return this.chats.review(userId, id, body);
  }

  /** «Очистить переписку». */
  @Post(":id/clear")
  @HttpCode(200)
  async clear(@CurrentUser() userId: string, @Param("id", ParseIntPipe) id: number) {
    return { chat: await this.chats.clear(userId, id) };
  }
}
