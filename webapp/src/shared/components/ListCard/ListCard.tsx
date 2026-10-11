import { Paper, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";
import styles from "./ListCard.module.css";

interface ListCardProps {
  /** Подпись группы над карточкой. */
  title?: string;
  /** Строки — ListRow. */
  children: ReactNode;
}

/** Группа строк: подпись и карточка, в которой строки ListRow разделены линией. */
export function ListCard({ title, children }: ListCardProps) {
  return (
    <Stack gap={6}>
      {title && (
        <Text size="xs" fw={600} tt="uppercase" c="dimmed" px="xs">
          {title}
        </Text>
      )}
      <Paper className={styles.card}>{children}</Paper>
    </Stack>
  );
}
