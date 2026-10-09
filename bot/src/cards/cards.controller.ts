import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { CardGenerationService } from "./card-generation.service.js";
import { CardsService } from "./cards.service.js";
import { AnswerCardQuestionsDto } from "./dto/answer-card-questions.dto.js";
import { CardInputDto } from "./dto/card-input.dto.js";
import { GenerateCardBlockDto } from "./dto/generate-card-block.dto.js";

/**
 * /api/cards — карточки «Мастерской» текущего пользователя: CRUD и поблочная генерация. Форма
 * ответов (`{ cards }`, `{ card }`, `{ ok: true }`, шаг генерации) — контракт webapp, сохранён с Hono-версии.
 */
@Controller("cards")
export class CardsController {
  constructor(
    private readonly cards: CardsService,
    private readonly generation: CardGenerationService,
  ) {}

  @Get()
  async list(@CurrentUser() userId: number) {
    return { cards: await this.cards.list(userId) };
  }

  @Get(":id")
  async get(@CurrentUser() userId: number, @Param("id", ParseIntPipe) id: number) {
    return { card: await this.cards.get(userId, id) };
  }

  @Post()
  async create(@CurrentUser() userId: number, @Body() input: CardInputDto) {
    return { card: await this.cards.create(userId, input) };
  }

  @Put(":id")
  async update(@CurrentUser() userId: number, @Param("id", ParseIntPipe) id: number, @Body() input: CardInputDto) {
    return { card: await this.cards.update(userId, id, input) };
  }

  @Delete(":id")
  async remove(@CurrentUser() userId: number, @Param("id", ParseIntPipe) id: number) {
    await this.cards.remove(userId, id);
    return { ok: true };
  }

  /**
   * Генерация блока: без categoryId — следующий незаполненный, с ним — явная «Перегенерировать».
   * status "questions" — модель попросила уточнение (ask_user), клиент отвечает ручкой ниже.
   * 200, а не 201 по умолчанию для POST: ничего не создаётся, контракт Hono-версии.
   */
  @Post(":id/generate")
  @HttpCode(200)
  generate(@CurrentUser() userId: number, @Param("id", ParseIntPipe) id: number, @Body() body: GenerateCardBlockDto) {
    return this.generation.generate(userId, id, body.categoryId);
  }

  /** Ответ (или отказ — skipped) на вопросы ask_user категории; вопросы хранятся на карточке, без таймаута. */
  @Post(":id/generate/answer")
  @HttpCode(200)
  answer(@CurrentUser() userId: number, @Param("id", ParseIntPipe) id: number, @Body() body: AnswerCardQuestionsDto) {
    const input = body.skipped ? { skipped: true as const } : { skipped: false as const, answers: body.answers ?? [] };
    return this.generation.answer(userId, id, body.categoryId, input);
  }
}
