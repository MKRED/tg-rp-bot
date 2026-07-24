import { miniApp, useSignal } from "@telegram-apps/sdk-react";
import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { THEME_MODE_KEY, TGUI_BG_DARK, TGUI_BG_LIGHT } from "./constants";

/** "system" — брать тему из Telegram (дефолт); "light"/"dark" — ручной оверрайд пользователя. */
export type ThemeMode = "system" | "light" | "dark";
type Appearance = "light" | "dark";

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** Итоговая тема для AppRoot: mode "system" деривится из Telegram, иначе — сам mode. */
  appearance: Appearance;
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

/**
 * Единый источник темы приложения. Стоит НАД AppRoot — и корневой AppRoot (App.tsx), и
 * вложенный в PromptEditorOverlay (уходит в портал, но не из React-дерева) читают один и тот
 * же resolved appearance через useTheme(). Без общего источника ручной оверрайд, применённый
 * на одном из них, не долетел бы до другого — оверлей «телепортировался» бы в другую тему.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  // Вызывается безусловно (правила хуков) даже в режимах light/dark — иначе возврат
  // в "system" не подхватит живую смену темы Telegram без дополнительной подписки.
  const isDarkFromTelegram = useSignal(miniApp.isDark);
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    try {
      localStorage.setItem(THEME_MODE_KEY, next);
    } catch (err) {
      console.warn("Не удалось сохранить выбор темы в localStorage", err);
    }
  };

  const appearance: Appearance = mode === "system" ? (isDarkFromTelegram ? "dark" : "light") : mode;

  // Красим body синхронно из appearance (не читаем DOM/computed style AppRoot): чтение
  // --tgui--bg_color с реального DOM-узла AppRoot через getComputedStyle давало гонку —
  // значение отставало от appearance на один рендер (переключение темы туда-сюда быстро
  // расходилось с фактическим AppRoot). TGUI_BG_LIGHT/TGUI_BG_DARK — литералы дефолтов
  // --tgui--bg_color самой библиотеки (сверено с исходником telegram-ui@2.1.13), не наша
  // догадка. --tg-bg-color (miniApp, отдельно от themeParams) — первым приоритетом, он точнее
  // в Full Screen после сворачивания/разворачивания (см. комментарий в index.css).
  useLayoutEffect(() => {
    const fallback = appearance === "dark" ? TGUI_BG_DARK : TGUI_BG_LIGHT;
    document.body.style.setProperty("background", `var(--tg-bg-color, var(--tg-theme-bg-color, ${fallback}))`);
  }, [appearance]);

  const value = useMemo(() => ({ mode, setMode, appearance }), [mode, appearance]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
