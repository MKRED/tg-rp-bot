import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * Маршрут без авторизации: глобальный TelegramAuthGuard его пропускает, @CurrentUser() там недоступен.
 * Только для того, что по природе публично (health-check; в шаге 3 — вход по логину).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
