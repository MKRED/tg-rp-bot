import type { MantineColorsTuple } from "@mantine/core";

/*
  Палитра приложения — единственное место, где задаются цвета. Первая версия нейтральная: серые для
  фона/текста/рамок + один акцент. Поменять характер приложения = поправить кортежи и поверхности ниже.
  Кортеж Mantine — 10 оттенков от светлого [0] к тёмному [9].
*/

/** Акцент (primary): кнопки, ссылки, активные элементы. */
export const accent: MantineColorsTuple = [
  "#e7f3ff",
  "#d0e6fb",
  "#a1cbf5",
  "#6eaeef",
  "#4596ea",
  "#2b87e7",
  "#1c7fe6",
  "#0d6dcd",
  "#0060b8",
  "#0053a3",
];

/** Нейтральный серый светлой схемы (текст, рамки, приглушённые подписи). */
export const gray: MantineColorsTuple = [
  "#f8f9fa",
  "#f1f3f5",
  "#e9ecef",
  "#dee2e6",
  "#ced4da",
  "#adb5bd",
  "#868e96",
  "#495057",
  "#343a40",
  "#212529",
];

/** Нейтральный тёмный: из него Mantine строит тёмную схему (фон, поверхности, текст). */
export const dark: MantineColorsTuple = [
  "#c9c9c9",
  "#b8b8b8",
  "#828282",
  "#696969",
  "#424242",
  "#3b3b3b",
  "#2e2e2e",
  "#242424",
  "#1f1f1f",
  "#141414",
];

/**
 * Поверхности по схемам: page — фон страницы (и шапки Telegram, см. useTelegramChrome), surface —
 * карточки и поля поверх него. Hex, а не ссылки на кортежи: эти же значения уходят в Telegram
 * (setHeaderColor принимает только #rrggbb).
 */
export const surfaces = {
  light: { page: "#f1f3f5", surface: "#ffffff" },
  dark: { page: "#141414", surface: "#1f1f1f" },
} as const;
