/*
  Общий темп анимаций: framer-motion (страницы, списки, раскрытие) и переходы Mantine (Modal, Drawer,
  Popover, Menu — через defaultProps в theme.ts) берут длительность и кривую отсюда, чтобы всё
  двигалось одинаково. framer-motion считает в секундах, Mantine — в миллисекундах.
*/

/** Базовая длительность, мс. */
export const MOTION_DURATION_MS = 200;

/** Кривая «быстрый старт, мягкая остановка» (easeOutQuint-подобная). */
export const MOTION_EASE = [0.22, 1, 0.36, 1] as const;

/** Готовый transition для framer-motion. */
export const MOTION_TRANSITION = { duration: MOTION_DURATION_MS / 1000, ease: MOTION_EASE };

/** Та же кривая для CSS и Mantine (timingFunction). */
export const MOTION_EASE_CSS = `cubic-bezier(${MOTION_EASE.join(", ")})`;
