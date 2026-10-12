import { themeParams, useSignal } from "@telegram-apps/sdk-react";
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { FONT_PAIR_KEY, PALETTE_KEY, THEME_MODE_KEY } from "./constants";
import { DEFAULT_FONT_PAIR, FONT_PAIRS, type FontPairId, loadFontPair } from "./fonts";
import { DEFAULT_PALETTE, PALETTES, type Palette, type PaletteId } from "./palettes";
import { parseStoredChoice } from "./storedChoice";

/** "system" — брать тему из Telegram (дефолт); "light"/"dark" — ручной оверрайд пользователя. */
export type ThemeMode = "system" | "light" | "dark";
type Appearance = "light" | "dark";

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** Итоговая схема для Mantine: mode "system" деривится из Telegram, иначе — сам mode. */
  appearance: Appearance;
  /** Палитра (выбор пользователя в настройках). */
  palette: PaletteId;
  setPalette: (palette: PaletteId) => void;
  /** Поверхности выбранной палитры — фон страницы и шапки Telegram (App.tsx). */
  surfaces: Palette["surfaces"];
  /** Пара шрифтов (выбор пользователя в настройках). */
  fontPair: FontPairId;
  setFontPair: (fontPair: FontPairId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredMode(): ThemeMode {
  // localStorage может бросить (приватный режим Safari, исчерпана квота) — тема не критична,
  // в худшем случае откатываемся на "system" вместо падения всего приложения на старте.
  try {
    const raw = localStorage.getItem(THEME_MODE_KEY);
    return raw === "light" || raw === "dark" ? raw : "system";
  } catch (err) {
    console.warn("Не удалось прочитать сохранённую тему из localStorage", err);
    return "system";
  }
}

/** Выбор из localStorage; недоступный localStorage или чужое значение — fallback. */
function readStoredChoice<T extends string>(key: string, options: Record<T, unknown>, fallback: T): T {
  try {
    return parseStoredChoice(localStorage.getItem(key), options, fallback);
  } catch (err) {
    console.warn(`Не удалось прочитать ${key} из localStorage`, err);
    return fallback;
  }
}

function storeChoice(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.warn(`Не удалось сохранить ${key} в localStorage`, err);
  }
}

/**
 * Единый источник темы приложения: режим (авто/светлая/тёмная), палитра и шрифты. Выбор хранится в
 * localStorage — на устройстве, как и раньше режим темы. Стоит НАД MantineProvider (App.tsx) —
 * тот берёт схему, палитру и шрифты через useTheme().
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  // Вызывается безусловно (правила хуков) даже в режимах light/dark — иначе возврат
  // в "system" не подхватит живую смену темы Telegram без дополнительной подписки.
  // themeParams.isDark — по фону темы самого Telegram. НЕ miniApp.isDark: тот считается по фону Mini App,
  // который мы сами перекрашиваем под палитру (useTelegramChrome), — «Авто» после «Светлой» видело бы
  // свой же светлый фон и оставалось светлым в тёмном Telegram.
  const isDarkFromTelegram = useSignal(themeParams.isDark);
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);
  const [palette, setPaletteState] = useState<PaletteId>(() => readStoredChoice(PALETTE_KEY, PALETTES, DEFAULT_PALETTE));
  const [fontPair, setFontPairState] = useState<FontPairId>(() =>
    readStoredChoice(FONT_PAIR_KEY, FONT_PAIRS, DEFAULT_FONT_PAIR),
  );

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    storeChoice(THEME_MODE_KEY, next);
  }, []);
  const setPalette = useCallback((next: PaletteId) => {
    setPaletteState(next);
    storeChoice(PALETTE_KEY, next);
  }, []);
  const setFontPair = useCallback((next: FontPairId) => {
    setFontPairState(next);
    storeChoice(FONT_PAIR_KEY, next);
  }, []);

  // В layout effect — до первой отрисовки, чтобы запрос шрифта ушёл как можно раньше.
  useLayoutEffect(() => loadFontPair(fontPair), [fontPair]);

  const appearance: Appearance = mode === "system" ? (isDarkFromTelegram ? "dark" : "light") : mode;

  const value = useMemo(
    () => ({
      mode,
      setMode,
      appearance,
      palette,
      setPalette,
      surfaces: PALETTES[palette].surfaces,
      fontPair,
      setFontPair,
    }),
    [mode, setMode, appearance, palette, setPalette, fontPair, setFontPair],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
