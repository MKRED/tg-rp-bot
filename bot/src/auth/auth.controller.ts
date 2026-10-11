import { Body, Controller, Get, HttpCode, Post, Put, Req, Res, UseGuards } from "@nestjs/common";
import { SkipThrottle, ThrottlerGuard } from "@nestjs/throttler";
import type { AuthSession } from "@tg-rp-bot/shared";
import type { Request, Response } from "express";
import { config } from "../config.js";
import { AuthService } from "./auth.service.js";
import type { TgUser } from "./auth.types.js";
import { CurrentUser } from "./current-user.decorator.js";
import { CredentialsDto } from "./dto/credentials.dto.js";
import { Public } from "./public.decorator.js";
import { clearSessionCookie, readCookie, setSessionCookie } from "./session/session-cookie.js";
import { TelegramUser } from "./telegram-user.decorator.js";

/**
 * /api/auth — вход по логину и паролю для браузера (в Mini App вход по initData, без этих маршрутов).
 * Регистрация и вход ограничены по частоте (ThrottlerGuard, лимит — в AuthModule), чтобы пароль
 * нельзя было подбирать.
 */
@Controller("auth")
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("register")
  async register(@Body() dto: CredentialsDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    setSessionCookie(res, await this.auth.register(dto, userAgent(req)), config.isProduction);
    return { ok: true };
  }

  @Public()
  @Post("login")
  @HttpCode(200)
  async login(@Body() dto: CredentialsDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    setSessionCookie(res, await this.auth.login(dto, userAgent(req)), config.isProduction);
    return { ok: true };
  }

  /**
   * Логин и пароль для входа в браузере — задаёт аккаунт из Telegram в настройках Mini App.
   * @TelegramUser() здесь — проверка способа входа: по cookie (браузер) ответ 409 telegram_not_linked.
   * Браузерный аккаунт логин уже имеет, а задать пароль чужому аккаунту по украденной cookie нельзя.
   */
  @Put("credentials")
  async setCredentials(
    @CurrentUser() userId: string,
    @TelegramUser() _tgUser: NonNullable<TgUser>,
    @Body() dto: CredentialsDto,
  ) {
    await this.auth.setCredentials(userId, dto);
    return { ok: true };
  }

  // Public: выход должен работать и с уже просроченной сессией (cookie гасим в любом случае).
  @Public()
  @SkipThrottle()
  @Post("logout")
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(readCookie(req.headers.cookie));
    clearSessionCookie(res, config.isProduction);
    return { ok: true };
  }

  /** Кто вошёл — webapp вне Telegram решает по нему, показывать ли экран входа. */
  @SkipThrottle()
  @Get("session")
  session(@CurrentUser() userId: string): Promise<AuthSession> {
    return this.auth.session(userId);
  }
}

function userAgent(req: Request): string | null {
  return req.headers["user-agent"]?.slice(0, 500) ?? null;
}
