import { Stack, Text } from "@mantine/core";
import { useEffect, type CSSProperties } from "react";
import { ChoiceCard, useChoiceGroup } from "../../components/ChoiceCard";
import { FONT_PAIRS, type FontPair, type FontPairId, loadFontPair } from "../fonts";
import { useTheme } from "../ThemeProvider";
import styles from "./FontPicker.module.css";

const PAIRS = Object.entries(FONT_PAIRS) as [FontPairId, FontPair][];
const IDS = PAIRS.map(([id]) => id);

/** Выбор шрифтов: каждый вариант набран своей парой — название заголовочным, строка текстовым. */
export function FontPicker() {
  const { fontPair, setFontPair } = useTheme();
  const { groupProps, tabIndexOf } = useChoiceGroup(IDS, fontPair, setFontPair);

  // Превью рисуется самими шрифтами — подгружаем все пары, пока открыт выбор (несколько файлов).
  useEffect(() => {
    for (const [id] of PAIRS) loadFontPair(id);
  }, []);

  return (
    <Stack gap="sm" {...groupProps} aria-label="Шрифты">
      {PAIRS.map(([id, pair]) => (
        <ChoiceCard
          key={id}
          selected={fontPair === id}
          onSelect={() => setFontPair(id)}
          ariaLabel={pair.label}
          tabIndex={tabIndexOf(id)}
        >
          <div
            className={styles.preview}
            style={{ "--preview-body": pair.body, "--preview-headings": pair.headings } as CSSProperties}
          >
            <Text className={styles.heading}>{pair.label}</Text>
            <Text size="sm" c="dimmed" className={styles.body}>
              Персонаж улыбнулся и продолжил историю
            </Text>
          </div>
        </ChoiceCard>
      ))}
    </Stack>
  );
}
