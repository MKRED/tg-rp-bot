import { Text } from "@mantine/core";
import styles from "./StoryFeed.module.css";

/**
 * Декоративный «разрыв сцены» между битами, сгенерированными подряд («Дальше» без директивы). Без
 * директивы нет чипа-режиссёра, и два бита сливались бы — орнамент отмечает границу.
 */
export function BeatDivider() {
  return (
    <Text size="sm" c="dimmed" className={styles.divider} aria-hidden>
      ✦ ✦ ✦
    </Text>
  );
}
