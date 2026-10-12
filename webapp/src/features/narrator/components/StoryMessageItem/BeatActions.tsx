import { ActionIcon, Group, Text } from "@mantine/core";
import { Check, ChevronLeft, ChevronRight, Copy, Globe, History, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { StoryMessage } from "../../types/story";
import type { TranslateControl } from "./translateControl";
import styles from "./StoryMessageItem.module.css";

interface BeatActionsProps {
  message: StoryMessage;
  /** Текст, который копируем — тот, что сейчас на экране (оригинал или перевод). */
  displayText: string;
  translate?: TranslateControl;
  /** Идёт генерация — действия, меняющие историю, недоступны. */
  disabled: boolean;
  /** Откат к этому биту (настройка «Откат к биту», не на последнем бите). */
  onRollback?: () => Promise<void>;
  /** Правка текста (настройка «Редактирование битов»). */
  onEdit?: () => void;
  editSaving: boolean;
  /** Последний бит, не открывающий: варианты, перегенерация, удаление. */
  tail?: {
    onSwitchSibling: (siblingId: number) => void;
    onRegenerate: () => void;
    onDelete: () => void;
  };
}

const COPIED_MS = 1500;

/** Строка действий под битом: перевод, откат, варианты ← N/M →, копирование, правка, перегенерация, удаление. */
export function BeatActions({
  message,
  displayText,
  translate,
  disabled,
  onRollback,
  onEdit,
  editSaving,
  tail,
}: BeatActionsProps) {
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);
  const [rollbackPending, setRollbackPending] = useState(false);

  const { siblings, siblingIndex, siblingCount } = message;
  const prevId = siblingIndex > 0 ? (siblings[siblingIndex - 1] ?? null) : null;
  const nextId = siblingIndex < siblingCount - 1 ? (siblings[siblingIndex + 1] ?? null) : null;

  const copy = () => {
    navigator.clipboard
      .writeText(displayText)
      .then(() => {
        setCopied(true);
        clearTimeout(copiedTimer.current);
        copiedTimer.current = setTimeout(() => setCopied(false), COPIED_MS);
      })
      .catch((err) => console.error("Failed to copy beat", err));
  };

  const rollback = async () => {
    if (!onRollback) return;
    setRollbackPending(true);
    try {
      await onRollback();
    } finally {
      setRollbackPending(false);
    }
  };

  return (
    <Group gap={2} className={styles.actions}>
      {translate && (
        <ActionIcon
          variant={translate.active ? "light" : "subtle"}
          color={translate.active ? undefined : "gray"}
          size="lg"
          loading={translate.pending}
          onClick={translate.onToggle}
          aria-label={translate.active ? "Показать оригинал" : "Перевести бит"}
          aria-pressed={translate.active}
          {...translate.longPress}
        >
          <Globe size={16} />
        </ActionIcon>
      )}
      {onRollback && (
        <ActionIcon
          variant="subtle"
          color="gray"
          size="lg"
          loading={rollbackPending}
          disabled={disabled}
          onClick={rollback}
          aria-label="Откатиться к этому биту"
        >
          <History size={16} />
        </ActionIcon>
      )}
      {tail && siblingCount > 1 && (
        <Group gap={0} wrap="nowrap">
          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg"
            disabled={disabled || prevId === null}
            onClick={() => prevId !== null && tail.onSwitchSibling(prevId)}
            aria-label="Предыдущий вариант"
          >
            <ChevronLeft size={16} />
          </ActionIcon>
          <Text size="xs" c="dimmed" className={styles.siblingCount}>
            {siblingIndex + 1}/{siblingCount}
          </Text>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg"
            disabled={disabled || nextId === null}
            onClick={() => nextId !== null && tail.onSwitchSibling(nextId)}
            aria-label="Следующий вариант"
          >
            <ChevronRight size={16} />
          </ActionIcon>
        </Group>
      )}
      <ActionIcon variant="subtle" color="gray" size="lg" onClick={copy} aria-label="Скопировать">
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </ActionIcon>
      {onEdit && (
        <ActionIcon
          variant="subtle"
          color="gray"
          size="lg"
          loading={editSaving}
          disabled={disabled}
          onClick={onEdit}
          aria-label="Редактировать бит"
        >
          <Pencil size={16} />
        </ActionIcon>
      )}
      {tail && (
        <>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg"
            disabled={disabled}
            onClick={tail.onRegenerate}
            aria-label="Перегенерировать"
          >
            <RefreshCw size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg"
            className={styles.danger}
            disabled={disabled}
            onClick={tail.onDelete}
            aria-label="Удалить бит"
          >
            <Trash2 size={16} />
          </ActionIcon>
        </>
      )}
    </Group>
  );
}
