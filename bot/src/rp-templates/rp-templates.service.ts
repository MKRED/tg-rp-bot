import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { MAX_RP_TEMPLATES_PER_USER, type RpTemplateInput, type RpTemplateListItem } from "@tg-rp-bot/shared";
import type { RpTemplate } from "../db/schema.js";
import { templateTokenWeight } from "../prompt/templateTokenWeight.js";
import { isFkViolation } from "../common/fk-violation.js";
import { found } from "../common/found.js";
import { RpTemplatesRepository } from "./rp-templates.repository.js";

/** RP-шаблоны пользователя: правила домена (лимит, «не найден», «используется») поверх репозитория. */
@Injectable()
export class RpTemplatesService {
  constructor(private readonly repository: RpTemplatesRepository) {}

  /** Тексты промптов на клиент не уходят — только их суммарный вес в токенах. */
  async list(userId: number): Promise<RpTemplateListItem[]> {
    const rows = await this.repository.list(userId);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      updatedAt: row.updatedAt.toISOString(),
      templateTokens: templateTokenWeight(row, row.promptOrder),
    }));
  }

  async get(userId: number, id: number): Promise<RpTemplate> {
    return found(await this.repository.findOne(userId, id));
  }

  async create(userId: number, input: RpTemplateInput): Promise<RpTemplate> {
    if ((await this.repository.count(userId)) >= MAX_RP_TEMPLATES_PER_USER) {
      throw new BadRequestException(`Template limit reached (max ${MAX_RP_TEMPLATES_PER_USER})`);
    }
    return this.repository.create(userId, input);
  }

  async update(userId: number, id: number, input: RpTemplateInput): Promise<RpTemplate> {
    return found(await this.repository.update(userId, id, input));
  }

  async remove(userId: number, id: number): Promise<void> {
    let deleted: boolean;
    try {
      deleted = await this.repository.delete(userId, id);
    } catch (err) {
      // FK (23503): шаблон привязан к чату (chats.template_id NOT NULL) — 409 in_use.
      if (isFkViolation(err)) throw new ConflictException("in_use");
      throw err;
    }
    if (!deleted) throw new NotFoundException("Not found");
  }
}
