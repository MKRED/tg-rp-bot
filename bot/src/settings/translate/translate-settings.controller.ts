import { Body, Controller, Get, Patch } from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import { TranslateSettingsPatchDto } from "../dto/settings-patch.dto.js";
import { TranslateSettingsService } from "./translate-settings.service.js";

/**
 * /api/settings/translate — настройки по умолчанию для режима перевода в PromptEditorOverlay (движок,
 * целевой язык, свой ИИ-промпт, reasoning). Не путать с /settings/llm (ключ DeepSeek) и с
 * translateMethod чатов/историй.
 */
@Controller("settings/translate")
export class TranslateSettingsController {
  constructor(private readonly settings: TranslateSettingsService) {}

  @Get()
  get(@CurrentUser() userId: number) {
    return this.settings.get(userId);
  }

  @Patch()
  update(@CurrentUser() userId: number, @Body() patch: TranslateSettingsPatchDto) {
    return this.settings.update(userId, patch);
  }
}
