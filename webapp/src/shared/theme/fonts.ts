/*
  Шрифты приложения — единственное место, где задаются семейства. Компоненты и CSS-модули шрифт не
  указывают, только var(--mantine-font-family) / var(--mantine-font-family-headings).

  Подключить шрифт из Google Fonts:
  1. <link> в index.html (место помечено комментарием) — с кириллицей (subset задаётся самим css2-URL
     по семейству; проверить, что у шрифта есть cyrillic) и display=swap;
  2. имя семейства — первым в нужном стеке ниже (системный стек остаётся фоллбэком).
*/

/** Системный стек: SF на Apple, Segoe UI на Windows, Roboto на Android. */
const SYSTEM_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** Основной текст. */
export const FONT_BODY = SYSTEM_STACK;

/** Заголовки (Title). */
export const FONT_HEADINGS = SYSTEM_STACK;
