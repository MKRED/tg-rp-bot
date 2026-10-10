import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import { BooksService } from "./books.service.js";
import { BookInputDto } from "./dto/book-input.dto.js";

/** /api/books — CRUD книг знаний. Форма ответов ({ books }, { book }, { ok: true }) — с Hono-версии. */
@Controller("books")
export class BooksController {
  constructor(private readonly books: BooksService) {}

  @Get()
  async list(@CurrentUser() userId: string) {
    return { books: await this.books.list(userId) };
  }

  @Post()
  async create(@CurrentUser() userId: string, @Body() input: BookInputDto) {
    return { book: await this.books.create(userId, input) };
  }

  @Get(":id")
  async get(@CurrentUser() userId: string, @Param("id", ParseIntPipe) id: number) {
    return { book: await this.books.get(userId, id) };
  }

  @Put(":id")
  async update(@CurrentUser() userId: string, @Param("id", ParseIntPipe) id: number, @Body() input: BookInputDto) {
    return { book: await this.books.update(userId, id, input) };
  }

  @Delete(":id")
  async remove(@CurrentUser() userId: string, @Param("id", ParseIntPipe) id: number) {
    await this.books.remove(userId, id);
    return { ok: true };
  }
}
