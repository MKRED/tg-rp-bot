import { ConflictException, createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthenticatedRequest, TgUser } from "./auth.types.js";

/**
 * Профиль Telegram текущего пользователя (кладёт AuthGuard). ТОЛЬКО для эндпоинтов, которые
 * по сути привязаны к Telegram (/me: профиль, фото профиля и сообщение в личку через Bot API —
 * им нужен Telegram id, а не внутренний). Доменные контроллеры берут @CurrentUser().
 *
 * Профиль есть только при входе из Mini App; при входе по логину в браузере — 409
 * telegram_not_linked (webapp прячет такие действия, но сервер не должен падать).
 */
export const TelegramUser = createParamDecorator((_data: unknown, context: ExecutionContext): NonNullable<TgUser> => {
  const user = context.switchToHttp().getRequest<AuthenticatedRequest>().tgUser;
  if (!user) {
    throw new ConflictException({ error: "telegram_not_linked", message: "Доступно только в Telegram" });
  }
  return user;
});
