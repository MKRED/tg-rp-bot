import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import type { ProfilePhotoResponse } from "@tg-rp-bot/shared";
import type { TgUser } from "../auth/auth.types.js";
import { TelegramUser } from "../auth/telegram-user.decorator.js";
import { SendPhotoDto } from "./dto/send-photo.dto.js";
import { MeService } from "./me.service.js";

/**
 * /api/me — текущий пользователь Telegram. Исключение из правила @CurrentUser(): эндпоинты по сути
 * про Telegram (профиль из initData, Bot API), поэтому берут профиль через @TelegramUser().
 */
@Controller("me")
export class MeController {
  constructor(private readonly me: MeService) {}

  /** Профиль из проверенного initData. */
  @Get()
  profile(@TelegramUser() user: NonNullable<TgUser>) {
    return { ok: true, user };
  }

  /** initData не содержит фото при запуске кнопкой/меню — сервер берёт его через Bot API. */
  @Get("photo")
  async photo(@TelegramUser() user: NonNullable<TgUser>): Promise<ProfilePhotoResponse> {
    return { dataUrl: await this.me.profilePhoto(user.id) };
  }

  /** Действие, а не создание ресурса — 200 { ok: true }, как у Hono-контроллера. */
  @Post("send-photo")
  @HttpCode(200)
  async sendPhoto(@TelegramUser() user: NonNullable<TgUser>, @Body() dto: SendPhotoDto) {
    await this.me.sendPhoto(user.id, dto);
    return { ok: true };
  }
}
