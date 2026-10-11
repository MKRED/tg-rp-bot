import type { MantineColorsTuple } from "@mantine/core";

/*
  Палитра приложения — единственное место, где задаются цвета. Кортеж Mantine — 10 оттенков от
  светлого [0] к тёмному [9]: accent — primary (кнопки, ссылки, активные элементы), gray — нейтральный
  светлой схемы (текст, рамки, приглушённые подписи), dark — из него Mantine строит тёмную схему.
  surfaces: page — фон страницы (и шапки Telegram, см. useTelegramChrome), surface — карточки и поля
  поверх него. Hex, а не ссылки на кортежи: эти же значения уходят в Telegram (setHeaderColor
  принимает только #rrggbb).

  Палитр несколько — пользователь выбирает в настройках (ThemeProvider, PalettePicker). Добавить
  палитру = объект ниже + строка в PALETTES; label — подпись в выборе.
*/

export interface Palette {
  label: string;
  accent: MantineColorsTuple;
  gray: MantineColorsTuple;
  dark: MantineColorsTuple;
  surfaces: { light: { page: string; surface: string }; dark: { page: string; surface: string } };
}

const neutral: Palette = {
  label: "Нейтральная",
  accent: ["#e7f3ff", "#d0e6fb", "#a1cbf5", "#6eaeef", "#4596ea", "#2b87e7", "#1c7fe6", "#0d6dcd", "#0060b8", "#0053a3"],
  gray: ["#f8f9fa", "#f1f3f5", "#e9ecef", "#dee2e6", "#ced4da", "#adb5bd", "#868e96", "#495057", "#343a40", "#212529"],
  dark: ["#c9c9c9", "#b8b8b8", "#828282", "#696969", "#424242", "#3b3b3b", "#2e2e2e", "#242424", "#1f1f1f", "#141414"],
  surfaces: { light: { page: "#f1f3f5", surface: "#ffffff" }, dark: { page: "#141414", surface: "#1f1f1f" } },
};

/** Янтарь на тёплой бумаге; в тёмной — «золото на чернилах»: глубокий сине-чернильный фон. */
const amber: Palette = {
  label: "Янтарная",
  accent: ["#fff8e1", "#ffefc0", "#ffe08a", "#ffd05c", "#ffc233", "#f7b01a", "#e89d06", "#c08000", "#9a6600", "#744c00"],
  gray: ["#faf8f5", "#f3efe9", "#e9e3da", "#ddd5c9", "#cbc0b1", "#aa9f8f", "#877b6c", "#5f564b", "#433c34", "#2a251f"],
  dark: ["#d8dbe3", "#b6bbc8", "#8b91a2", "#656c7e", "#3e4456", "#313647", "#272b3a", "#1e2230", "#181b26", "#11131b"],
  surfaces: { light: { page: "#f5f0e8", surface: "#fffdf9" }, dark: { page: "#0f1118", surface: "#1a1d28" } },
};

/** Фиолетовый, «фэнтези»; серые с лавандовым оттенком, тёмная — сливовая. */
const violet: Palette = {
  label: "Фиолетовая",
  accent: ["#f3edff", "#e2d7fd", "#c2acf6", "#a17ef0", "#8558ea", "#7340e7", "#6933e6", "#5826cd", "#4e20b8", "#421aa2"],
  gray: ["#f9f8fc", "#f2f0f8", "#e7e4f0", "#dad6e5", "#c5c0d4", "#a39db6", "#807a94", "#5b566c", "#413d4f", "#29273a"],
  dark: ["#ddd9e7", "#bdb7cd", "#918aa7", "#6c6584", "#443e59", "#363049", "#2b263c", "#221e31", "#1b1827", "#13111c"],
  surfaces: { light: { page: "#f3f2f8", surface: "#ffffff" }, dark: { page: "#121019", surface: "#1d1a28" } },
};

/** Бирюза, современный и спокойный; серые холодные, тёмная — графит с зеленцой. */
const teal: Palette = {
  label: "Бирюзовая",
  accent: ["#e3fafa", "#c5f1f0", "#8ee3e1", "#55d4d1", "#2ac6c3", "#13b5b2", "#0aa19e", "#06827f", "#046866", "#024f4d"],
  gray: ["#f8fafa", "#f0f3f4", "#e4e9eb", "#d4dbde", "#bdc7cb", "#99a6ab", "#748287", "#525e63", "#394347", "#232b2e"],
  dark: ["#d4dcdd", "#b3bebf", "#889596", "#636f71", "#3d4648", "#30383a", "#262d2f", "#1e2426", "#171d1f", "#101416"],
  surfaces: { light: { page: "#eef2f3", surface: "#ffffff" }, dark: { page: "#0e1214", surface: "#192022" } },
};

export const PALETTES = { neutral, amber, violet, teal } satisfies Record<string, Palette>;
export type PaletteId = keyof typeof PALETTES;

/** Палитра по умолчанию — пока пользователь не выбрал свою. */
export const DEFAULT_PALETTE: PaletteId = "amber";
