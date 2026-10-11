import { Group, SegmentedControl } from "@mantine/core";
import { Monitor, Moon, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { useTheme, type ThemeMode } from "./ThemeProvider";

const ICON_SIZE = 16;

const THEME_OPTIONS = [
  { value: "system", label: "Авто", icon: <Monitor size={ICON_SIZE} /> },
  { value: "light", label: "Светлая", icon: <Sun size={ICON_SIZE} /> },
  { value: "dark", label: "Тёмная", icon: <Moon size={ICON_SIZE} /> },
] as const satisfies { value: ThemeMode; label: string; icon: ReactNode }[];

const DATA = THEME_OPTIONS.map(({ value, label, icon }) => ({
  value,
  label: (
    <Group gap={6} justify="center" wrap="nowrap">
      {icon}
      <span>{label}</span>
    </Group>
  ),
}));

/** Выбор темы: авто (как в Telegram, по умолчанию) / светлая / тёмная. */
export function ThemeToggle() {
  const { mode, setMode } = useTheme();
  return (
    <SegmentedControl
      fullWidth
      data={DATA}
      value={mode}
      onChange={(value) => setMode(value as ThemeMode)}
      aria-label="Тема оформления"
    />
  );
}
