import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { config } from "../config.js";
import logger from "../logger.js";
import { UsersService } from "../users/users.service.js";
import type { AuthenticatedRequest } from "./auth.types.js";
import { authenticateInitData } from "./initData.js";
import { IS_PUBLIC_KEY } from "./public.decorator.js";

/**
 * Глобальный guard API: пропускает запрос с валидным Telegram initData (или dev-обходом) и кладёт
 * в запрос внутренний userId (его отдаёт @CurrentUser()) и профиль Telegram. Заодно гарантирует
 * строку в users — контроллерам больше не нужно звать ensureUser перед записью.
 *
 * Шаг 3 плана (вход по логину) добавит второй способ входа; контроллеры не изменятся, пока
 * guard кладёт тот же userId.
 */
@Injectable()
export class TelegramAuthGuard implements CanActivate {
  constructor(
    private readonly usersService: UsersService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const result = authenticateInitData(request.headers.authorization, {
      botToken: config.botToken,
      devUserId: config.devUserId,
    });

    if (!result.ok) {
      // Клиентская ошибка (подделка/просрочка) — warn, не error.
      if (result.cause) logger.warn({ err: result.cause }, "Invalid Telegram initData rejected");
      throw new UnauthorizedException(result.error);
    }
    if (result.devBypass) logger.debug({ devUserId: result.user.id }, "Dev auth: initData bypassed");

    await this.usersService.ensureTelegramUser(result.user);
    request.tgUser = result.user;
    request.userId = result.user.id;
    return true;
  }
}
