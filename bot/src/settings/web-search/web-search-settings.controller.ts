import { Body, Controller, Get, Patch } from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import { WebSearchSettingsPatchDto } from "../dto/settings-patch.dto.js";
import { WebSearchSettingsRepository } from "./web-search-settings.repository.js";

/**
 * /api/settings/web-search — лимит раундов веб-поиска при генерации карточек. Доменных правил нет
 * (кламп — в репозитории), поэтому без отдельного сервиса.
 */
@Controller("settings/web-search")
export class WebSearchSettingsController {
  constructor(private readonly settings: WebSearchSettingsRepository) {}

  @Get()
  get(@CurrentUser() userId: string) {
    return this.settings.get(userId);
  }

  @Patch()
  update(@CurrentUser() userId: string, @Body() patch: WebSearchSettingsPatchDto) {
    return this.settings.upsert(userId, patch);
  }
}
