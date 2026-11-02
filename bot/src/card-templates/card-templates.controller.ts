import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { CardTemplatesService } from "./card-templates.service.js";
import { CardTemplateInputDto } from "./dto/card-template-input.dto.js";

/** /api/card-templates — CRUD шаблонов карточек текущего пользователя (`{ templates }`, `{ template }`, `{ ok: true }`). */
@Controller("card-templates")
export class CardTemplatesController {
  constructor(private readonly templates: CardTemplatesService) {}

  @Get()
  async list(@CurrentUser() userId: string) {
    return { templates: await this.templates.list(userId) };
  }

  @Get(":id")
  async get(@CurrentUser() userId: string, @Param("id", ParseIntPipe) id: number) {
    return { template: await this.templates.get(userId, id) };
  }

  @Post()
  async create(@CurrentUser() userId: string, @Body() input: CardTemplateInputDto) {
    return { template: await this.templates.create(userId, input) };
  }

  @Put(":id")
  async update(
    @CurrentUser() userId: string,
    @Param("id", ParseIntPipe) id: number,
    @Body() input: CardTemplateInputDto,
  ) {
    return { template: await this.templates.update(userId, id, input) };
  }

  @Delete(":id")
  async remove(@CurrentUser() userId: string, @Param("id", ParseIntPipe) id: number) {
    await this.templates.remove(userId, id);
    return { ok: true };
  }
}
