import { Button, createTheme, Input, rem } from "@mantine/core";
import { FONT_BODY, FONT_HEADINGS } from "./fonts";
import { MOTION_DURATION_MS, MOTION_EASE_CSS } from "./motion";
import { accent, dark, gray } from "./palettes";

// Поля ввода — size md (16px): при шрифте меньше 16px iOS зумит страницу на фокусе.
const inputDefaults = { defaultProps: { size: "md" } };
// Цель нажатия на телефоне — не меньше 44px; у Mantine md — 42px, поднимаем.
const TOUCH_TARGET = rem(44);
// Оверлеи анимирует сама Mantine — в общем темпе с framer-motion (motion.ts).
const overlayTransition = { duration: MOTION_DURATION_MS, timingFunction: MOTION_EASE_CSS };

export const theme = createTheme({
  primaryColor: "accent",
  colors: { accent, gray, dark },
  defaultRadius: "md",
  fontFamily: FONT_BODY,
  headings: { fontFamily: FONT_HEADINGS },
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
    Input: Input.extend({
      vars: (_theme, props) => ({ wrapper: props.size === "md" ? { "--input-height": TOUCH_TARGET } : {} }),
    }),
    Button: Button.extend({
      defaultProps: { size: "md" },
      vars: (_theme, props) => ({ root: props.size === "md" ? { "--button-height": TOUCH_TARGET } : {} }),
    }),
    Modal: { defaultProps: { transitionProps: overlayTransition } },
    Drawer: { defaultProps: { transitionProps: overlayTransition } },
    Popover: { defaultProps: { transitionProps: overlayTransition } },
    Menu: { defaultProps: { transitionProps: overlayTransition } },
    Tooltip: { defaultProps: { transitionProps: overlayTransition } },
  },
});
