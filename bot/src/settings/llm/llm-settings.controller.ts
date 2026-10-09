import { Body, Controller, Get, HttpCode, Patch, Post } from "@nestjs/common";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import { LlmSettingsPatchDto, VerifyKeyDto } from "../dto/settings-patch.dto.js";
import { LlmSettingsService } from "./llm-settings.service.js";

/**
 * /api/settings/llm — персональные ключ/модель DeepSeek (BYOK). Сам ключ никогда не отдаётся —
 * только статус (hasKey, last4, model). Форма ответов — контракт webapp, сохранён с Hono-версии.
 */
@Controller("settings/llm")
export class LlmSettingsController {
  constructor(private readonly settings: LlmSettingsService) {}

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

  @Get("balance")
  balance(@CurrentUser() userId: number) {
    return this.settings.balance(userId);
  }

  @Patch()
  update(@CurrentUser() userId: number, @Body() patch: LlmSettingsPatchDto) {
    return this.settings.update(userId, patch);
  }
}
