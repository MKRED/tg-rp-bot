import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { MAX_CARD_TEMPLATES_PER_USER, type CardTemplate, type CardTemplateInput } from "@tg-rp-bot/shared";
import { found } from "../common/found.js";
import type { CardTemplateRow } from "../db/schema.js";
import { CardTemplatesRepository } from "./card-templates.repository.js";

/** Строка БД (Date) → контракт API (ISO-строки, без user_id). */
function toTemplate(row: CardTemplateRow): CardTemplate {
  return {
    id: row.id,
    name: row.name,
    systemPrompt: row.systemPrompt,
    fields: row.fields,
    useWebSearch: row.useWebSearch,
    useAskUser: row.useAskUser,
    askUserFirst: row.askUserFirst,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Шаблоны карточек пользователя: лимит и «не найден» поверх репозитория. */
@Injectable()
export class CardTemplatesService {
  constructor(private readonly repository: CardTemplatesRepository) {}

  /** Список отдаёт шаблоны целиком: они небольшие, а пикеру в карточке нужен весь шаблон. */
  async list(userId: string): Promise<CardTemplate[]> {
    return (await this.repository.list(userId)).map(toTemplate);
  }

  async get(userId: string, id: number): Promise<CardTemplate> {
    return toTemplate(found(await this.repository.findOne(userId, id)));
  }

  async create(userId: string, input: CardTemplateInput): Promise<CardTemplate> {
    if ((await this.repository.count(userId)) >= MAX_CARD_TEMPLATES_PER_USER) {
      throw new BadRequestException(`Template limit reached (max ${MAX_CARD_TEMPLATES_PER_USER})`);
    }
    return toTemplate(await this.repository.create(userId, input));
  }

  async update(userId: string, id: number, input: CardTemplateInput): Promise<CardTemplate> {
    return toTemplate(found(await this.repository.update(userId, id, input)));
  }

  /** Карточки шаблон не держат (копия при выборе), поэтому удаление ничем не блокируется. */
  async remove(userId: string, id: number): Promise<void> {
    if (!(await this.repository.delete(userId, id))) throw new NotFoundException("Not found");
  }
}
