import { Paper, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";
import styles from "./NavList.module.css";

interface NavListProps {
  /** Подпись группы над карточкой. */
  title?: string;
  /** Строки — NavItem. */
  children: ReactNode;
}

/** Группа пунктов навигации: подпись и карточка, в которой строки NavItem разделены линией. */
export function NavList({ title, children }: NavListProps) {
  return (
    <Stack gap={6}>
      {title && (
        <Text size="xs" fw={600} tt="uppercase" c="dimmed" px="xs">
          {title}
        </Text>
      )}
      <Paper className={styles.card}>
        {children}
      </Paper>
    </Stack>
  );
}
