import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthenticatedRequest } from "./auth.types.js";

/**
 * Внутренний id текущего пользователя (кладёт TelegramAuthGuard). Контроллеры работают только с
 * ним, а не с профилем Telegram — так способ входа можно менять, не трогая контроллеры.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): number =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().userId,
);
