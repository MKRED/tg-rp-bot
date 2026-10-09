import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { MAX_PRESETS_PER_USER, type PresetInput, type PresetListItem } from "@tg-rp-bot/shared";
import type { GenerationPreset } from "../db/schema.js";
import { isFkViolation } from "../common/fk-violation.js";
import { found } from "../common/found.js";
import { PresetsRepository } from "./presets.repository.js";

/** Пресеты генерации пользователя: правила домена (лимит, «не найден», «используется») поверх репозитория. */
@Injectable()
export class PresetsService {
  constructor(private readonly repository: PresetsRepository) {}

  list(userId: number): Promise<PresetListItem[]> {
    return this.repository.list(userId);
  }

  async get(userId: number, id: number): Promise<GenerationPreset> {
    return found(await this.repository.findOne(userId, id));
  }

  async create(userId: number, input: PresetInput): Promise<GenerationPreset> {
    if ((await this.repository.count(userId)) >= MAX_PRESETS_PER_USER) {
      throw new BadRequestException(`Preset limit reached (max ${MAX_PRESETS_PER_USER})`);
    }
    return this.repository.create(userId, input);
  }

  async update(userId: number, id: number, input: PresetInput): Promise<GenerationPreset> {
    return found(await this.repository.update(userId, id, input));
  }

  async remove(userId: number, id: number): Promise<void> {
    let deleted: boolean;
    try {
      deleted = await this.repository.delete(userId, id);
    } catch (err) {
      // FK (23503): пресет привязан к чату, истории или карточке — 409 in_use, webapp показывает понятный текст.
      if (isFkViolation(err)) throw new ConflictException("in_use");
      throw err;
    }
    if (!deleted) throw new NotFoundException("Not found");
  }
}
