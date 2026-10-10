import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { type EntryInput, type EntryListItem, MAX_ENTRIES_PER_BOOK } from "@tg-rp-bot/shared";
import { CharactersRepository } from "../../characters/characters.repository.js";
import { found } from "../../common/found.js";
import { PersonasRepository } from "../../personas/personas.repository.js";
import { EntriesRepository } from "./entries.repository.js";
import { characterNeedsUserAlias, personaNeedsCharAlias } from "./entry-alias.js";

/** Записи книги знаний: ссылки на своих персонажей/персон, alias, мягкий лимит, порядок. */
@Injectable()
export class EntriesService {
  constructor(
    private readonly entries: EntriesRepository,
    private readonly characters: CharactersRepository,
    private readonly personas: PersonasRepository,
  ) {}

  /** Владение книгой проверяет репозиторий: для чужой/несуществующей книги — []. */
  list(userId: string, bookId: number): Promise<EntryListItem[]> {
    return this.entries.list(userId, bookId);
  }

  async create(userId: string, bookId: number, input: EntryInput): Promise<{ id: number }> {
    await this.checkReference(userId, input);
    if ((await this.entries.count(userId, bookId)) >= MAX_ENTRIES_PER_BOOK) {
      throw new BadRequestException(`Entry limit reached (max ${MAX_ENTRIES_PER_BOOK})`);
    }
    const created = await this.entries.create(userId, bookId, input);
    if (!created) throw new NotFoundException("Book not found");
    return created;
  }

  async update(userId: string, entryId: number, input: EntryInput): Promise<void> {
    await this.checkReference(userId, input);
    if (!(await this.entries.update(userId, entryId, input))) found(undefined);
  }

  async remove(userId: string, entryId: number): Promise<void> {
    if (!(await this.entries.remove(userId, entryId))) found(undefined);
  }

  /** Порядок принимается, только если это ровно перестановка записей книги (иначе — рассинхрон клиента). */
  async reorder(userId: string, bookId: number, order: number[]): Promise<void> {
    if ((await this.entries.reorder(userId, bookId, order)) === "invalid") {
      throw new BadRequestException("Invalid order");
    }
  }

  /**
   * Запись-персонаж/персона: сущность должна принадлежать пользователю; если её промпт/сценарий
   * ссылается на недостающую сторону ({{user}} у персонажа, {{char}} у персоны), alias обязателен.
   */
  private async checkReference(userId: string, input: EntryInput): Promise<void> {
    if (input.characterId !== null) {
      const character = await this.characters.findOne(userId, input.characterId);
      if (!character) throw new NotFoundException("Character not found");
      if (characterNeedsUserAlias(character) && !input.alias) throw new BadRequestException("Alias required");
    }
    if (input.personaId !== null) {
      const persona = await this.personas.findOne(userId, input.personaId);
      if (!persona) throw new NotFoundException("Persona not found");
      if (personaNeedsCharAlias(persona) && !input.alias) throw new BadRequestException("Alias required");
    }
  }
}
