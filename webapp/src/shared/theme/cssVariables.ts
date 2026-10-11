import type { CSSVariablesResolver } from "@mantine/core";
import { surfaces } from "./palettes";

/*
  CSS-переменные по схемам. --mantine-color-body — фон карточек и полей (Paper, Input красятся им),
  --app-color-page — фон страницы под карточками (AppPage). Свои переменные — с префиксом --app-.
*/
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    "--mantine-color-body": surfaces.light.surface,
    "--app-color-page": surfaces.light.page,
  },
  dark: {
    "--mantine-color-body": surfaces.dark.surface,
    "--app-color-page": surfaces.dark.page,
  },
});
