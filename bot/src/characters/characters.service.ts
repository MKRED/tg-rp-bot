import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { type CharacterInput, type CharacterListItem, MAX_CHARACTERS_PER_USER } from "@tg-rp-bot/shared";
import type { Character } from "../db/schema.js";
import { isFkViolation } from "../server/shared/fkViolation.js";
import { CharactersRepository } from "./characters.repository.js";

/** Персонажи пользователя: правила домена (лимит, «не найден», «используется») поверх репозитория. */
@Injectable()
export class CharactersService {
  constructor(private readonly repository: CharactersRepository) {}

  list(userId: number): Promise<CharacterListItem[]> {
    return this.repository.list(userId);
  }

  async get(userId: number, id: number): Promise<Character> {
    return found(await this.repository.findOne(userId, id));
  }

  /** Аватар: null — персонаж есть, но без картинки. */
  async getImage(userId: number, id: number): Promise<string | null> {
    return found(await this.repository.findImage(userId, id));
  }

  /** Полноразмерное фото: null — персонаж есть, но без фото. */
  async getImageFull(userId: number, id: number): Promise<string | null> {
    return found(await this.repository.findImageFull(userId, id));
  }

  async create(userId: number, input: CharacterInput): Promise<Character> {
    if ((await this.repository.count(userId)) >= MAX_CHARACTERS_PER_USER) {
      throw new BadRequestException(`Character limit reached (max ${MAX_CHARACTERS_PER_USER})`);
    }
    return this.repository.create(userId, input);
  }

  async update(userId: number, id: number, input: CharacterInput): Promise<Character> {
    return found(await this.repository.update(userId, id, input));
  }

  async remove(userId: number, id: number): Promise<void> {
    let deleted: boolean;
    try {
      deleted = await this.repository.delete(userId, id);
    } catch (err) {
      // FK (23503): персонаж привязан к чату — 409 in_use, webapp показывает понятный текст.
      if (isFkViolation(err)) throw new ConflictException("in_use");
      throw err;
    }
    if (!deleted) throw new NotFoundException("Not found");
  }
}

/** undefined от репозитория — «нет такого у пользователя» (чужой id неотличим от несуществующего). */
function found<T>(value: T | undefined): T {
  if (value === undefined) throw new NotFoundException("Not found");
  return value;
}
