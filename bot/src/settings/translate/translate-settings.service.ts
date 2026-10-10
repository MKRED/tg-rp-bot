import { Injectable } from "@nestjs/common";
import type { TranslateSettings, TranslateSettingsPatch } from "@tg-rp-bot/shared";
import { TranslateSettingsRepository } from "./translate-settings.repository.js";

/**
 * Настройки режима перевода PromptEditorOverlay. Доменных правил нет — невалидные поля патча
 * отсекает DTO, — сервис держит единую раскладку контроллер → сервис → репозиторий.
 */
@Injectable()
export class TranslateSettingsService {
  constructor(private readonly settings: TranslateSettingsRepository) {}

  get(userId: string): Promise<TranslateSettings> {
    return this.settings.get(userId);
  }

  update(userId: string, patch: TranslateSettingsPatch): Promise<TranslateSettings> {
    return this.settings.upsert(userId, patch);
  }
}
