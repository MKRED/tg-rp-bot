import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { PersonasService } from "./personas.service.js";
import { PersonaInputDto } from "./dto/persona-input.dto.js";

/**
 * /api/personas — CRUD персон текущего пользователя. Форма ответов (`{ personas }`,
 * `{ persona }`, `{ dataUrl }`, `{ ok: true }`) — контракт webapp, сохранён с Hono-версии.
 */
@Controller("personas")
export class PersonasController {
  constructor(private readonly personas: PersonasService) {}

  /** Список (метаданные, без картинок). */
  @Get()
  async list(@CurrentUser() userId: number) {
    return { personas: await this.personas.list(userId) };
  }

  @Get(":id")
  async get(@CurrentUser() userId: number, @Param("id", ParseIntPipe) id: number) {
    return { persona: await this.personas.get(userId, id) };
  }

  /** Аватар data URL'ом — отдельным запросом, чтобы список не тянул base64. Картинку не логируем. */
  @Get(":id/image")
  async image(@CurrentUser() userId: number, @Param("id", ParseIntPipe) id: number) {
    return { dataUrl: await this.personas.getImage(userId, id) };
  }

  /** Полноразмерное фото — при открытии лайтбокса. */
  @Get(":id/image/full")
  async imageFull(@CurrentUser() userId: number, @Param("id", ParseIntPipe) id: number) {
    return { dataUrl: await this.personas.getImageFull(userId, id) };
  }

  @Post()
  async create(@CurrentUser() userId: number, @Body() input: PersonaInputDto) {
    return { persona: await this.personas.create(userId, input) };
  }

  @Put(":id")
  async update(
    @CurrentUser() userId: number,
    @Param("id", ParseIntPipe) id: number,
    @Body() input: PersonaInputDto,
  ) {
    return { persona: await this.personas.update(userId, id, input) };
  }

  @Delete(":id")
  async remove(@CurrentUser() userId: number, @Param("id", ParseIntPipe) id: number) {
    await this.personas.remove(userId, id);
    return { ok: true };
  }
}
