import { Injectable } from "@nestjs/common";
import type { ChatSettings } from "@tg-rp-bot/shared";
import { ChatContextService } from "../chat-context.service.js";
import { ChatSettingsRepository } from "./chat-settings.repository.js";

/** Настройки перевода чата. */
@Injectable()
export class ChatSettingsService {
  constructor(
    private readonly settings: ChatSettingsRepository,
    private readonly access: ChatContextService,
  ) {}

  async get(userId: string, chatId: number): Promise<ChatSettings> {
    await this.access.requireRow(userId, chatId);
    return this.settings.get(chatId);
  }

  /**
   * Сохраняет только корректные переданные поля (DTO обнулил невалидные). Пустой патч — без записи:
   * upsert с пустым SET — невалидный SQL.
   */
  async update(userId: string, chatId: number, input: Partial<ChatSettings>): Promise<ChatSettings> {
    await this.access.requireRow(userId, chatId);
    const patch = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as Partial<ChatSettings>;
    if (Object.keys(patch).length === 0) return this.settings.get(chatId);
    return this.settings.upsert(chatId, patch);
  }
}
