import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import type { AvatarBatchResponse } from "@tg-rp-bot/shared";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { AvatarBatchDto } from "./dto/avatar-batch.dto.js";
import { AvatarsService } from "./avatars.service.js";

@Controller("avatars")
export class AvatarsController {
  constructor(private readonly avatars: AvatarsService) {}

  /** Чтение батчем, а не создание ресурса — 200, как у Hono-контроллера. */
  @Post("batch")
  @HttpCode(200)
  async batch(@CurrentUser() userId: number, @Body() dto: AvatarBatchDto): Promise<AvatarBatchResponse> {
    return { avatars: await this.avatars.resolveBatch(userId, dto.refs) };
  }
}
