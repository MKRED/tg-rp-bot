import { Body, Controller, Get, HttpCode, Patch, Post } from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import { TavilySettingsPatchDto, VerifyKeyDto } from "../dto/settings-patch.dto.js";
import { TavilySettingsService } from "./tavily-settings.service.js";

/** /api/settings/tavily — персональный ключ Tavily (веб-поиск, BYOK); сам ключ не отдаётся. */
@Controller("settings/tavily")
export class TavilySettingsController {
  constructor(private readonly settings: TavilySettingsService) {}

  @Get()
  get(@CurrentUser() userId: number) {
    return this.settings.get(userId);
  }

  /** 200, а не 201 по умолчанию для POST: ok:false (нет/неверный ключ) — тоже штатный результат. */
  @Post("verify")
  @HttpCode(200)
  verify(@CurrentUser() userId: number, @Body() body: VerifyKeyDto) {
    return this.settings.verify(userId, body.apiKey);
  }

  @Patch()
  update(@CurrentUser() userId: number, @Body() patch: TavilySettingsPatchDto) {
    return this.settings.update(userId, patch);
  }
}
