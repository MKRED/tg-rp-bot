import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { MAX_PERSONAS_PER_USER, type PersonaInput, type PersonaListItem } from "@tg-rp-bot/shared";
import type { Persona } from "../db/schema.js";
import { isFkViolation } from "../common/fk-violation.js";
import { found } from "../common/found.js";
import { PersonasRepository } from "./personas.repository.js";

/** Персоны пользователя: правила домена (лимит, «не найдена», «используется») поверх репозитория. */
@Injectable()
export class PersonasService {
  constructor(private readonly repository: PersonasRepository) {}

  list(userId: number): Promise<PersonaListItem[]> {
    return this.repository.list(userId);
  }

  async get(userId: number, id: number): Promise<Persona> {
    return found(await this.repository.findOne(userId, id));
  }

  /** Аватар: null — персона есть, но без картинки. */
  async getImage(userId: number, id: number): Promise<string | null> {
    return found(await this.repository.findImage(userId, id));
  }

  /** Полноразмерное фото: null — персона есть, но без фото. */
  async getImageFull(userId: number, id: number): Promise<string | null> {
    return found(await this.repository.findImageFull(userId, id));
  }

  async create(userId: number, input: PersonaInput): Promise<Persona> {
    if ((await this.repository.count(userId)) >= MAX_PERSONAS_PER_USER) {
      throw new BadRequestException(`Persona limit reached (max ${MAX_PERSONAS_PER_USER})`);
    }
    return this.repository.create(userId, input);
  }

  async update(userId: number, id: number, input: PersonaInput): Promise<Persona> {
    return found(await this.repository.update(userId, id, input));
  }

  async remove(userId: number, id: number): Promise<void> {
    let deleted: boolean;
    try {
      deleted = await this.repository.delete(userId, id);
    } catch (err) {
      // FK (23503): персона привязана к чату — 409 in_use, webapp показывает понятный текст.
      if (isFkViolation(err)) throw new ConflictException("in_use");
      throw err;
    }
    if (!deleted) throw new NotFoundException("Not found");
  }
}
