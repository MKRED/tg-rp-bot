import { ActionIcon, Collapse, Group, Text, UnstyledButton } from "@mantine/core";
import { ChevronRight, Trash2 } from "lucide-react";
import { useState } from "react";
import type { StoryCompaction } from "../../../types/story";
import styles from "./StoryCompactCard.module.css";

interface CompactionItemProps {
  compaction: StoryCompaction;
  /** Номер по порядку (с 1). */
  number: number;
  busy: boolean;
  onRemove: () => void;
}

const fmt = (n: number) => n.toLocaleString("ru-RU");

/** Пересказ в списке: свёрнут по умолчанию (текст длинный), раскрывается по нажатию; удаление справа. */
export function CompactionItem({ compaction, number, busy, onRemove }: CompactionItemProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={styles.item}>
      <Group gap={4} wrap="nowrap">
        <UnstyledButton className={styles.itemToggle} onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
          <ChevronRight size={16} className={styles.chevron} data-open={expanded || undefined} aria-hidden />
          <Text size="sm" fw={500}>
            Пересказ {number}
          </Text>
          <Text size="xs" c="dimmed">
            {compaction.coveredCount} сообщ. · ~{fmt(compaction.coveredTokens)} ток.
          </Text>
        </UnstyledButton>
        <ActionIcon
          variant="subtle"
          color="red"
          size="lg"
          disabled={busy}
          onClick={onRemove}
          aria-label={`Удалить пересказ ${number}`}
        >
          <Trash2 size={18} />
        </ActionIcon>
      </Group>
      <Collapse expanded={expanded}>
        <Text size="sm" c="dimmed" className={styles.summary}>
          {compaction.summary}
        </Text>
      </Collapse>
    </div>
  );
}
