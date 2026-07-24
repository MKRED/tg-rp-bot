import { Monitor, Moon, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { SegmentedToggle } from "../components/SegmentedToggle";
import { useTheme, type ThemeMode } from "./ThemeProvider";

const ICON_SIZE = 16;

const THEME_OPTIONS = [
  { value: "system", label: "Система", icon: <Monitor size={ICON_SIZE} /> },
  { value: "light", label: "Светлая", icon: <Sun size={ICON_SIZE} /> },
  { value: "dark", label: "Тёмная", icon: <Moon size={ICON_SIZE} /> },
] as const satisfies { value: ThemeMode; label: string; icon: ReactNode }[];

/** Тумблер выбора темы: Система (по умолчанию, из Telegram) / Светлая / Тёмная. */
export function ThemeToggle() {
  const { mode, setMode } = useTheme();
  return <SegmentedToggle options={THEME_OPTIONS} value={mode} onChange={setMode} ariaLabel="Тема оформления" />;
}
