import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { PresetsService } from "./presets.service.js";
import { PresetInputDto } from "./dto/preset-input.dto.js";

/**
 * /api/presets — CRUD пресетов генерации текущего пользователя. Форма ответов (`{ presets }`,
 * `{ preset }`, `{ ok: true }`) — контракт webapp, сохранён с Hono-версии.
 */
@Controller("presets")
export class PresetsController {
  constructor(private readonly presets: PresetsService) {}

  /** Список (поля для сводки под названием, без полного сэмплинга). */
  @Get()
  async list(@CurrentUser() userId: number) {
    return { presets: await this.presets.list(userId) };
  }

  @Get(":id")
  async get(@CurrentUser() userId: number, @Param("id", ParseIntPipe) id: number) {
    return { preset: await this.presets.get(userId, id) };
  }

  @Post()
  async create(@CurrentUser() userId: number, @Body() input: PresetInputDto) {
    return { preset: await this.presets.create(userId, input) };
  }

  @Put(":id")
  async update(
    @CurrentUser() userId: number,
    @Param("id", ParseIntPipe) id: number,
    @Body() input: PresetInputDto,
  ) {
    return { preset: await this.presets.update(userId, id, input) };
  }

  @Delete(":id")
  async remove(@CurrentUser() userId: number, @Param("id", ParseIntPipe) id: number) {
    await this.presets.remove(userId, id);
    return { ok: true };
  }
}
