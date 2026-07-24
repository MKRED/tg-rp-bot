/** Ключ localStorage для сохранённого выбора темы (переопределение темы Telegram). */
export const THEME_MODE_KEY = "theme-mode";

/**
 * Дефолтные значения --tgui--bg_color самой библиотеки @telegram-apps/telegram-ui@2.1.13
 * (см. node_modules/.../dist/styles.css, классы AppRoot .tgui-6a12827a138e8827/.tgui-865b921add8ee075) —
 * не наша догадка, сверено с исходником. При обновлении tgui сверить заново.
 */
export const TGUI_BG_LIGHT = "#fff";
export const TGUI_BG_DARK = "#212121";
