import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { CSRF_HEADER, CSRF_HEADER_VALUE } from "@tg-rp-bot/shared";
import type { Response } from "express";
import { config } from "../config.js";
import logger from "../logger.js";
import { UsersService } from "../users/users.service.js";
import type { AuthenticatedRequest } from "./auth.types.js";
import { authenticateInitData } from "./initData.js";
import { IS_PUBLIC_KEY } from "./public.decorator.js";
import { readCookie, setSessionCookie } from "./session/session-cookie.js";
import { SessionsService } from "./session/sessions.service.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const TMA_SCHEME = /^tma\s/i;

/**
 * Глобальный guard API. Способ входа выбирается по запросу:
 * 1. заголовок `Authorization: tma …` (Mini App) — проверка initData, строка users по telegram_id;
 * 2. иначе cookie сессии (браузер, вход по логину) — пользователь из user_sessions;
 * 3. иначе dev-обход (только локально, DEV_USER_ID) или 401.
 * Оба способа кладут в запрос один и тот же внутренний userId (его отдаёт @CurrentUser()), поэтому
 * контроллерам всё равно, как пользователь вошёл.
 *
 * CSRF: изменяющий запрос без initData должен нести CSRF_HEADER. Cookie браузер приложит и к запросу
 * с чужого сайта, а собственный заголовок чужая страница без CORS поставить не может. Проверяется и
 * на публичных маршрутах — иначе чужой сайт мог бы залогинить пользователя в свой аккаунт.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly usersService: UsersService,
    private readonly sessions: SessionsService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const viaTelegram = TMA_SCHEME.test(request.headers.authorization ?? "");

    if (!viaTelegram && !SAFE_METHODS.has(request.method) && request.get(CSRF_HEADER) !== CSRF_HEADER_VALUE) {
      throw new ForbiddenException("Missing CSRF header");
    }
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;

    if (!viaTelegram) {
      const token = readCookie(request.headers.cookie);
      const session = token ? await this.sessions.resolve(token) : null;
      if (token && session) {
        request.userId = session.userId;
        // Срок в БД продлён — продлеваем и cookie, иначе браузер выбросит её через 30 дней от входа.
        if (session.extended) setSessionCookie(context.switchToHttp().getResponse<Response>(), token, config.isProduction);
        return true;
      }
    }

    // Mini App (или запрос без способа входа — тогда dev-обход либо отказ).
    const result = authenticateInitData(request.headers.authorization, {
      botToken: config.botToken,
      devUserId: config.devUserId,
    });

    if (!result.ok) {
      // Клиентская ошибка (подделка/просрочка) — warn, не error.
      if (result.cause) logger.warn({ err: result.cause }, "Invalid Telegram initData rejected");
      throw new UnauthorizedException(viaTelegram ? result.error : "Not authenticated");
    }
    if (result.devBypass) logger.debug({ devUserId: result.user.id }, "Dev auth: initData bypassed");

    request.userId = await this.usersService.ensureTelegramUser(result.user);
    request.tgUser = result.user;
    return true;
  }
}
