import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { NarratorTemplatesService } from "./narrator-templates.service.js";
import { NarratorTemplateInputDto } from "./dto/narrator-template-input.dto.js";

/**
 * /api/narrator-templates — CRUD narrator-шаблонов текущего пользователя. Форма ответов (`{ templates }`,
 * `{ template }`, `{ ok: true }`) — контракт webapp, сохранён с Hono-версии.
 */
@Controller("narrator-templates")
export class NarratorTemplatesController {
  constructor(private readonly templates: NarratorTemplatesService) {}

  /** Список (без текстов промптов, с их весом в токенах). */
  @Get()
  async list(@CurrentUser() userId: number) {
    return { templates: await this.templates.list(userId) };
  }

  @Get(":id")
  async get(@CurrentUser() userId: number, @Param("id", ParseIntPipe) id: number) {
    return { template: await this.templates.get(userId, id) };
  }

  @Post()
  async create(@CurrentUser() userId: number, @Body() input: NarratorTemplateInputDto) {
    return { template: await this.templates.create(userId, input) };
  }

  @Put(":id")
  async update(
    @CurrentUser() userId: number,
    @Param("id", ParseIntPipe) id: number,
    @Body() input: NarratorTemplateInputDto,
  ) {
    return { template: await this.templates.update(userId, id, input) };
  }

  @Delete(":id")
  async remove(@CurrentUser() userId: number, @Param("id", ParseIntPipe) id: number) {
    await this.templates.remove(userId, id);
    return { ok: true };
  }
}
