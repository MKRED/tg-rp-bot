import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import type { TranslateTextResponse } from "@tg-rp-bot/shared";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { TranslateTextDto } from "./dto/translate-text.dto.js";
import { TranslateService } from "./translate.service.js";

@Controller("translate")
export class TranslateController {
  constructor(private readonly translate: TranslateService) {}

  /** Действие, а не создание ресурса — 200, как у Hono-контроллера. */
  @Post("text")
  @HttpCode(200)
  async translateText(@CurrentUser() userId: string, @Body() dto: TranslateTextDto): Promise<TranslateTextResponse> {
    return { translations: await this.translate.translateBlocks(userId, dto) };
  }
}
