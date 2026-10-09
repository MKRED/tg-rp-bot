import { Module } from "@nestjs/common";
import { CharactersModule } from "../characters/characters.module.js";
import { PersonasModule } from "../personas/personas.module.js";
import { BooksController } from "./books/books.controller.js";
import { BooksRepository } from "./books/books.repository.js";
import { BooksService } from "./books/books.service.js";
import { EntriesPromptRepository } from "./entries/entries-prompt.repository.js";
import { EntriesController } from "./entries/entries.controller.js";
import { EntriesRepository } from "./entries/entries.repository.js";
import { EntriesService } from "./entries/entries.service.js";

/**
 * /api/books — книги знаний (lorebook) narrator-режима и их записи. Персонажи и персоны нужны
 * записям-ссылкам: проверка владения и обязательного alias.
 */
@Module({
  imports: [CharactersModule, PersonasModule],
  controllers: [BooksController, EntriesController],
  providers: [BooksService, BooksRepository, EntriesService, EntriesRepository, EntriesPromptRepository],
  // Книга истории и её записи для промпта — stories (сейчас через мост db/knowledge).
  exports: [BooksRepository, EntriesPromptRepository],
})
export class KnowledgeBooksModule {}
