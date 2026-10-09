import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthenticatedRequest } from "./auth.types.js";

/**
 * Профиль Telegram текущего пользователя (кладёт TelegramAuthGuard). ТОЛЬКО для эндпоинтов, которые
 * по сути привязаны к Telegram (/me: профиль, фото профиля и сообщение в личку через Bot API —
 * им нужен Telegram id, а не внутренний). Доменные контроллеры берут @CurrentUser().
 */
export const TelegramUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedRequest["tgUser"] =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().tgUser,
);
