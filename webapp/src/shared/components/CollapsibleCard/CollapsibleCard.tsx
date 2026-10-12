import { Collapse, Paper, Text, Title, UnstyledButton } from "@mantine/core";
import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import styles from "./CollapsibleCard.module.css";

interface CollapsibleCardProps {
  title: string;
  /** Пояснение под заголовком — видно и в свёрнутом виде. */
  description?: ReactNode;
  /** Открыта ли по умолчанию (по умолчанию свёрнута). */
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Карточка группы настроек, которая сворачивается по нажатию на заголовок, — для того, что правят
 * реже остального. Содержимое в свёрнутом виде не размонтируется: состояние полей сохраняется.
 */
export function CollapsibleCard({ title, description, defaultOpen = false, children }: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <Paper className={styles.card}>
      <UnstyledButton
        className={styles.head}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
      >
        <div className={styles.text}>
          <Title order={4}>{title}</Title>
          {description && (
            <Text size="sm" c="dimmed" mt={4}>
              {description}
            </Text>
          )}
        </div>
        <ChevronDown size={20} className={styles.chevron} data-open={open || undefined} aria-hidden />
      </UnstyledButton>
      <Collapse expanded={open} id={bodyId}>
        <div className={styles.body}>{children}</div>
      </Collapse>
    </Paper>
  );
}
