import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { RpTemplatesService } from "./rp-templates.service.js";
import { RpTemplateInputDto } from "./dto/rp-template-input.dto.js";

/**
 * /api/rp-templates — CRUD RP-шаблонов текущего пользователя. Форма ответов (`{ templates }`,
 * `{ template }`, `{ ok: true }`) — контракт webapp, сохранён с Hono-версии.
 */
@Controller("rp-templates")
export class RpTemplatesController {
  constructor(private readonly templates: RpTemplatesService) {}

  /** Список (без текстов промптов, с их весом в токенах). */
  @Get()
  async list(@CurrentUser() userId: string) {
    return { templates: await this.templates.list(userId) };
  }

  @Get(":id")
  async get(@CurrentUser() userId: string, @Param("id", ParseIntPipe) id: number) {
    return { template: await this.templates.get(userId, id) };
  }

  @Post()
  async create(@CurrentUser() userId: string, @Body() input: RpTemplateInputDto) {
    return { template: await this.templates.create(userId, input) };
  }

  @Put(":id")
  async update(
    @CurrentUser() userId: string,
    @Param("id", ParseIntPipe) id: number,
    @Body() input: RpTemplateInputDto,
  ) {
    return { template: await this.templates.update(userId, id, input) };
  }

  @Delete(":id")
  async remove(@CurrentUser() userId: string, @Param("id", ParseIntPipe) id: number) {
    await this.templates.remove(userId, id);
    return { ok: true };
  }
}
