import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { CharactersService } from "./characters.service.js";
import { CharacterInputDto } from "./dto/character-input.dto.js";

/**
 * /api/characters — CRUD персонажей текущего пользователя. Форма ответов (`{ characters }`,
 * `{ character }`, `{ dataUrl }`, `{ ok: true }`) — контракт webapp, сохранён с Hono-версии.
 */
@Controller("characters")
export class CharactersController {
  constructor(private readonly characters: CharactersService) {}

  /** Список (метаданные, без картинок). */
  @Get()
  async list(@CurrentUser() userId: number) {
    return { characters: await this.characters.list(userId) };
  }

  @Get(":id")
  async get(@CurrentUser() userId: number, @Param("id", ParseIntPipe) id: number) {
    return { character: await this.characters.get(userId, id) };
  }

  /** Аватар data URL'ом — отдельным запросом, чтобы список не тянул base64. Картинку не логируем. */
  @Get(":id/image")
  async image(@CurrentUser() userId: number, @Param("id", ParseIntPipe) id: number) {
    return { dataUrl: await this.characters.getImage(userId, id) };
  }

  /** Полноразмерное фото — при открытии лайтбокса. */
  @Get(":id/image/full")
  async imageFull(@CurrentUser() userId: number, @Param("id", ParseIntPipe) id: number) {
    return { dataUrl: await this.characters.getImageFull(userId, id) };
  }

  @Post()
  async create(@CurrentUser() userId: number, @Body() input: CharacterInputDto) {
    return { character: await this.characters.create(userId, input) };
  }

  @Put(":id")
  async update(
    @CurrentUser() userId: number,
    @Param("id", ParseIntPipe) id: number,
    @Body() input: CharacterInputDto,
  ) {
    return { character: await this.characters.update(userId, id, input) };
  }

  @Delete(":id")
  async remove(@CurrentUser() userId: number, @Param("id", ParseIntPipe) id: number) {
    await this.characters.remove(userId, id);
    return { ok: true };
  }
}
