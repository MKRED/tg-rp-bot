import { Button, createTheme, Input, Paper, rem } from "@mantine/core";
import type { FontPair } from "./fonts";
import { MOTION_DURATION_MS, MOTION_EASE_CSS } from "./motion";
import type { Palette } from "./palettes";

// Поля ввода — size md (16px): при шрифте меньше 16px iOS зумит страницу на фокусе. filled — заливка
// вместо обводки: на карточках без рамок поле читается фоном, а не ещё одной линией.
const inputDefaults = { defaultProps: { size: "md", variant: "filled" } };
// Цель нажатия на телефоне — не меньше 44px; у Mantine md — 42px, поднимаем.
const TOUCH_TARGET = rem(44);
// Оверлеи анимирует сама Mantine — в общем темпе с framer-motion (motion.ts).
const overlayTransition = { duration: MOTION_DURATION_MS, timingFunction: MOTION_EASE_CSS };

/** Тема Mantine под выбранные палитру и шрифты (ThemeProvider → App, пересобирается при смене). */
export const buildTheme = (palette: Palette, fonts: FontPair) =>
  createTheme({
    primaryColor: "accent",
    // Оттенок акцента для кнопок: в тёмной схеме светлее стандартного [8] — иначе янтарь становится
    // грязно-коричневым, а фиолетовый и бирюза — тусклыми на тёмном фоне.
    primaryShade: { light: 6, dark: 5 },
    colors: { accent: palette.accent, gray: palette.gray, dark: palette.dark },
    // Скругления крупнее стандартных Mantine: поля и кнопки — 12px, карточки — 16px (Paper ниже).
    radius: { xs: rem(4), sm: rem(8), md: rem(12), lg: rem(16), xl: rem(24) },
    defaultRadius: "md",
    // Цвет текста на кнопках — по яркости фона: на янтаре тёмный, на синем/фиолетовом белый.
    autoContrast: true,
    fontFamily: fonts.body,
    headings: { fontFamily: fonts.headings, fontWeight: "600" },
    // Системная настройка «уменьшить движение» отключает переходы Mantine (framer-motion — MotionConfig в App).
    respectReducedMotion: true,
    components: {
      TextInput: inputDefaults,
      PasswordInput: inputDefaults,
      Textarea: inputDefaults,
      NumberInput: inputDefaults,
      Select: inputDefaults,
      MultiSelect: inputDefaults,
      TagsInput: inputDefaults,
      Autocomplete: inputDefaults,
      SegmentedControl: { defaultProps: { size: "md" } },
      // Подпись тумблера — того же размера, что у полей (md), и крупнее цель нажатия.
      Switch: { defaultProps: { size: "md" } },
      Input: Input.extend({
        vars: (_theme, props) => ({ wrapper: props.size === "md" ? { "--input-height": TOUCH_TARGET } : {} }),
      }),
      Button: Button.extend({
        defaultProps: { size: "md" },
        vars: (_theme, props) => ({ root: props.size === "md" ? { "--button-height": TOUCH_TARGET } : {} }),
      }),
      // Карточки без рамок: в светлой схеме — мягкая тень, в тёмной — поверхность светлее фона
      // (--app-shadow-card, cssVariables.ts). withBorder на Paper не ставим.
      Paper: Paper.extend({ defaultProps: { radius: "lg", shadow: "var(--app-shadow-card)" } }),
      Modal: { defaultProps: { transitionProps: overlayTransition } },
      Drawer: { defaultProps: { transitionProps: overlayTransition } },
      Popover: { defaultProps: { transitionProps: overlayTransition } },
      Menu: { defaultProps: { transitionProps: overlayTransition } },
      Tooltip: { defaultProps: { transitionProps: overlayTransition } },
    },
  });
