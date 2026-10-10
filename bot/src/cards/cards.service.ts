import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { MAX_CARDS_PER_USER, type CardInput, type CardListItem } from "@tg-rp-bot/shared";
import type { Card } from "../db/schema.js";
import { found } from "../common/found.js";
import { PresetsRepository } from "../presets/presets.repository.js";
import { tryLockCard, unlockCard } from "./card-lock.js";
import { CardsRepository } from "./cards.repository.js";

/** Карточки «Мастерской»: правила домена (лимит, пресет, лок, «не найдена») поверх репозитория. */
@Injectable()
export class CardsService {
  constructor(
    private readonly repository: CardsRepository,
    private readonly presets: PresetsRepository,
  ) {}

  async list(userId: string): Promise<CardListItem[]> {
    const rows = await this.repository.list(userId);
    return rows.map((row) => ({ ...row, updatedAt: row.updatedAt.toISOString() }));
  }

  async get(userId: string, id: number): Promise<Card> {
    return found(await this.repository.findOne(userId, id));
  }

  async create(userId: string, input: CardInput): Promise<Card> {
    await this.assertPresetOwned(userId, input.presetId);
    if ((await this.repository.count(userId)) >= MAX_CARDS_PER_USER) {
      throw new BadRequestException(`Card limit reached (max ${MAX_CARDS_PER_USER})`);
    }
    return this.repository.create(userId, input);
  }

  async update(userId: string, id: number, input: CardInput): Promise<Card> {
    await this.assertPresetOwned(userId, input.presetId);
    // Тот же лок, что у генерации блока (card-lock.ts): оба пути делают read-modify-write полной
    // строки, без него параллельные PUT и «Сгенерировать» могли бы затереть друг друга.
    if (!tryLockCard(id)) throw new ConflictException("busy");
    try {
      return found(await this.repository.update(userId, id, input));
    } finally {
      unlockCard(id);
    }
  }

  async remove(userId: string, id: number): Promise<void> {
    if (!(await this.repository.delete(userId, id))) throw new NotFoundException("Not found");
  }

  /**
   * presetId необязателен, но если задан — обязан принадлежать пользователю: чужой (но
   * существующий) id прошёл бы FK и сохранился бы как валидный, а генерация (поиск пресета с
   * фильтром по владельцу) молча не нашла бы его — пользователь увидел бы вводящий в заблуждение
   * preset_required. Тот же ответ, что у чатов.
   */
  private async assertPresetOwned(userId: string, presetId: number | null): Promise<void> {
    if (presetId === null) return;
    if (!(await this.presets.findOne(userId, presetId))) throw new NotFoundException("Preset not found");
  }
}
