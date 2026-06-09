import { initData } from "@telegram-apps/sdk-react";

/**
 * Профиль текущего пользователя Telegram, приведённый к удобному виду.
 * Источник — initData.user() из SDK (заполняется после initData.restore() в init.ts).
 */
export interface TgUserInfo {
  id: number;
  /** Имя + фамилия одной строкой (фамилия может отсутствовать). */
  fullName: string;
  username?: string;
  photoUrl?: string;
  isPremium: boolean;
}

/**
 * Текущий пользователь Telegram или undefined.
 *
 * undefined — нормальная ситуация вне Telegram (dev-браузер) либо если SDK не отдал
 * initData. Поля приходят в snake_case (тип User из @telegram-apps/types).
 * ВАЖНО: это клиентские, НЕ доверенные данные — годятся только для отображения.
 * Любое доверенное действие на сервере проверяет подпись initData отдельно.
 */
export function getTgUser(): TgUserInfo | undefined {
  const user = initData.user();
  if (!user) return undefined;

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");
  return {
    id: user.id,
    fullName,
    username: user.username,
    photoUrl: user.photo_url,
    isPremium: Boolean(user.is_premium),
  };
}
