import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  MAX_NARRATOR_TEMPLATES_PER_USER,
  type NarratorTemplateInput,
  type NarratorTemplateListItem,
} from "@tg-rp-bot/shared";
import type { NarratorTemplate } from "../db/schema.js";
import { normalizeStoryPromptOrder } from "../server/prompt/storyPromptOrder.js";
import { templateTokenWeight } from "../server/prompt/templateTokenWeight.js";
import { isFkViolation } from "../server/shared/fkViolation.js";
import { found } from "../common/found.js";
import { NarratorTemplatesRepository } from "./narrator-templates.repository.js";

/** Narrator-шаблоны пользователя: правила домена (лимит, «не найден», «используется») поверх репозитория. */
@Injectable()
export class NarratorTemplatesService {
  constructor(private readonly repository: NarratorTemplatesRepository) {}

  /** Тексты промптов на клиент не уходят — только их суммарный вес в токенах. */
  async list(userId: number): Promise<NarratorTemplateListItem[]> {
    const rows = await this.repository.list(userId);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      updatedAt: row.updatedAt.toISOString(),
      templateTokens: templateTokenWeight(row, row.promptOrder),
    }));
  }

  /** Порядок нормализуется: старые шаблоны (6 компонентов) дополняются `compact` на дефолтную позицию. */
  async get(userId: number, id: number): Promise<NarratorTemplate> {
    const template = found(await this.repository.findOne(userId, id));
    return { ...template, promptOrder: normalizeStoryPromptOrder(template.promptOrder) };
  }

  async create(userId: number, input: NarratorTemplateInput): Promise<NarratorTemplate> {
    if ((await this.repository.count(userId)) >= MAX_NARRATOR_TEMPLATES_PER_USER) {
      throw new BadRequestException(`Template limit reached (max ${MAX_NARRATOR_TEMPLATES_PER_USER})`);
    }
    return this.repository.create(userId, input);
  }

  async update(userId: number, id: number, input: NarratorTemplateInput): Promise<NarratorTemplate> {
    return found(await this.repository.update(userId, id, input));
  }

  async remove(userId: number, id: number): Promise<void> {
    let deleted: boolean;
    try {
      deleted = await this.repository.delete(userId, id);
    } catch (err) {
      // FK (23503): шаблон привязан к истории (story_chats.template_id NOT NULL) — 409 in_use.
      if (isFkViolation(err)) throw new ConflictException("in_use");
      throw err;
    }
    if (!deleted) throw new NotFoundException("Not found");
  }
}
