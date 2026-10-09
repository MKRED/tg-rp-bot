import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import { EntryInputDto } from "./dto/entry-input.dto.js";
import { ReorderEntriesDto } from "./dto/reorder-entries.dto.js";
import { EntriesService } from "./entries.service.js";

/**
 * /api/books/:id/entries — записи книги знаний. PUT/DELETE записи адресуются по entryId; владение
 * проверяется через книгу пользователя, поэтому :id книги там не участвует (как в Hono-версии).
 */
@Controller("books/:id/entries")
export class EntriesController {
  constructor(private readonly entries: EntriesService) {}

  @Get()
  async list(@CurrentUser() userId: number, @Param("id", ParseIntPipe) bookId: number) {
    return { entries: await this.entries.list(userId, bookId) };
  }

  @Post()
  async create(@CurrentUser() userId: number, @Param("id", ParseIntPipe) bookId: number, @Body() input: EntryInputDto) {
    return { entry: await this.entries.create(userId, bookId, input) };
  }

  /** Объявлен РАНЬШЕ ":entryId" — иначе Express отдал бы "reorder" в параметр entryId. */
  @Put("reorder")
  async reorder(
    @CurrentUser() userId: number,
    @Param("id", ParseIntPipe) bookId: number,
    @Body() dto: ReorderEntriesDto,
  ) {
    await this.entries.reorder(userId, bookId, dto.order);
    return { ok: true };
  }

  @Put(":entryId")
  async update(
    @CurrentUser() userId: number,
    @Param("entryId", ParseIntPipe) entryId: number,
    @Body() input: EntryInputDto,
  ) {
    await this.entries.update(userId, entryId, input);
    return { ok: true };
  }

  @Delete(":entryId")
  async remove(@CurrentUser() userId: number, @Param("entryId", ParseIntPipe) entryId: number) {
    await this.entries.remove(userId, entryId);
    return { ok: true };
  }
}
