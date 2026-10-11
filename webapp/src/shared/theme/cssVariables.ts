import type { CSSVariablesResolver } from "@mantine/core";
import type { Palette } from "./palettes";

/*
  CSS-переменные по схемам. --mantine-color-body — фон карточек (Paper красится им), --app-color-page —
  фон страницы под карточками (AppPage), --app-shadow-card — тень карточки (рамок нет: в светлой схеме
  карточку отделяет тень, в тёмной — поверхность светлее фона и едва заметный блик сверху),
  --app-color-divider — линии внутри карточек. Свои переменные — с префиксом --app-.
*/
export const buildCssVariablesResolver =
  (surfaces: Palette["surfaces"]): CSSVariablesResolver =>
  () => ({
    variables: {},
    light: {
      "--mantine-color-body": surfaces.light.surface,
      "--app-color-page": surfaces.light.page,
      "--app-shadow-card": "0 1px 2px rgb(0 0 0 / 4%), 0 4px 16px rgb(0 0 0 / 5%)",
      "--app-color-divider": "var(--mantine-color-gray-2)",
    },
    dark: {
      "--mantine-color-body": surfaces.dark.surface,
      "--app-color-page": surfaces.dark.page,
      "--app-shadow-card": "inset 0 1px 0 rgb(255 255 255 / 4%), 0 2px 12px rgb(0 0 0 / 25%)",
      "--app-color-divider": "rgb(255 255 255 / 6%)",
    },
  });
