import { SimpleGrid, Text } from "@mantine/core";
import type { CSSProperties } from "react";
import { ChoiceCard, useChoiceGroup } from "../../components/ChoiceCard";
import { PALETTES, type Palette, type PaletteId } from "../palettes";
import { useTheme } from "../ThemeProvider";
import styles from "./PalettePicker.module.css";

const ITEMS = Object.entries(PALETTES) as [PaletteId, Palette][];
const IDS = ITEMS.map(([id]) => id);

/** Цвета превью — из данных палитры (их и показываем), через CSS-переменные модуля. */
function swatchVars(palette: Palette, scheme: "light" | "dark"): CSSProperties {
  const { page, surface } = palette.surfaces[scheme];
  return {
    "--swatch-page": page,
    "--swatch-surface": surface,
    // Тот же оттенок, что у кнопок (primaryShade в theme.ts).
    "--swatch-accent": palette.accent[scheme === "light" ? 6 : 5],
  } as CSSProperties;
}

/** Выбор палитры: превью светлой и тёмной схемы + название. */
export function PalettePicker() {
  const { palette, setPalette } = useTheme();
  const { groupProps, tabIndexOf } = useChoiceGroup(IDS, palette, setPalette);
  return (
    <SimpleGrid cols={{ base: 2, xs: 4 }} spacing="sm" {...groupProps} aria-label="Палитра">
      {ITEMS.map(([id, item]) => (
        <ChoiceCard
          key={id}
          selected={palette === id}
          onSelect={() => setPalette(id)}
          ariaLabel={item.label}
          tabIndex={tabIndexOf(id)}
        >
          <div className={styles.swatch} aria-hidden>
            {(["light", "dark"] as const).map((scheme) => (
              <div key={scheme} className={styles.half} style={swatchVars(item, scheme)}>
                <span className={styles.bar} />
                <span className={styles.dot} />
              </div>
            ))}
          </div>
          <Text size="sm" fw={500} mt={6} ta="center">
            {item.label}
          </Text>
        </ChoiceCard>
      ))}
    </SimpleGrid>
  );
}
