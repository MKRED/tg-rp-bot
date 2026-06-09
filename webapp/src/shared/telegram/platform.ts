import { retrieveLaunchParams } from "@telegram-apps/sdk-react";

/**
 * Платформа клиента Telegram (tgWebAppPlatform) в течение сессии не меняется.
 * Вне Telegram (dev-браузер) retrieveLaunchParams бросает → "unknown".
 */
export function getPlatform(): string {
  try {
    return retrieveLaunchParams(true).tgWebAppPlatform;
  } catch {
    return "unknown";
  }
}

// Нативные мобильные клиенты Telegram. Full Screen включаем только на них:
// на десктопе (tdesktop/macos) он лишь растягивает окно, что не нужно.
const MOBILE_PLATFORMS = new Set(["android", "android_x", "ios"]);

/** Мобильный клиент Telegram? По нему гейтим Full Screen. */
export function isMobilePlatform(): boolean {
  return MOBILE_PLATFORMS.has(getPlatform());
}
