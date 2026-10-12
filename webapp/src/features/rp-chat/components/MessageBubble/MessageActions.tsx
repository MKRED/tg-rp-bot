import { ActionIcon, Group, Text } from "@mantine/core";
import { Check, ChevronLeft, ChevronRight, Copy, Globe, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { useLongPress } from "../../../../shared/hooks/useLongPress";
import { confirmAction } from "../../../../shared/telegram/confirm";
import type { MessageInPath } from "../../types/chat";
import styles from "./MessageBubble.module.css";

/** Обработчики долгого нажатия — меню действий над переводом. */
type LongPressHandlers = ReturnType<typeof useLongPress>;

interface MessageActionsProps {
  message: MessageInPath;
  /** Текст, который копируем — тот, что сейчас на экране (оригинал или перевод). */
  displayText: string;
  translate?: {
    active: boolean;
    pending: boolean;
    onToggle: () => void;
    /** Есть кэш перевода — долгое нажатие открывает «перевести заново / удалить». */
    longPress?: LongPressHandlers;
  };
  canRegenerate: boolean;
  onSwitchBranch: (siblingId: number) => void;
  onEdit: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
}

const COPIED_MS = 1500;

/** Строка действий под пузырём: перевод, варианты ← N/M →, копирование, правка, перегенерация, удаление. */
export function MessageActions({
  message,
  displayText,
  translate,
  canRegenerate,
  onSwitchBranch,
  onEdit,
  onRegenerate,
  onDelete,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);

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
      .catch((err) => console.error("Failed to copy message", err));
  };

  const remove = async () => {
    const ok = await confirmAction("Удалить сообщение? Это действие необратимо.", {
      title: "Удаление сообщения",
      confirmText: "Удалить",
    });
    if (ok) onDelete();
  };

  return (
    <Group gap={2} wrap="nowrap" className={styles.actions}>
      {translate && (
        <ActionIcon
          variant={translate.active ? "light" : "subtle"}
          color={translate.active ? undefined : "gray"}
          size="lg"
          loading={translate.pending}
          onClick={translate.onToggle}
          aria-label={translate.active ? "Показать оригинал" : "Перевести"}
          aria-pressed={translate.active}
          {...translate.longPress}
        >
          <Globe size={16} />
        </ActionIcon>
      )}
      {siblingCount > 1 && (
        <Group gap={0} wrap="nowrap">
          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg"
            className={styles.arrow}
            disabled={prevId === null}
            onClick={() => prevId !== null && onSwitchBranch(prevId)}
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
            className={styles.arrow}
            disabled={nextId === null}
            onClick={() => nextId !== null && onSwitchBranch(nextId)}
            aria-label="Следующий вариант"
          >
            <ChevronRight size={16} />
          </ActionIcon>
        </Group>
      )}
      <ActionIcon variant="subtle" color="gray" size="lg" onClick={copy} aria-label="Скопировать">
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </ActionIcon>
      <ActionIcon variant="subtle" color="gray" size="lg" onClick={onEdit} aria-label="Редактировать">
        <Pencil size={16} />
      </ActionIcon>
      {canRegenerate && (
        <ActionIcon variant="subtle" color="gray" size="lg" onClick={onRegenerate} aria-label="Перегенерировать">
          <RefreshCw size={16} />
        </ActionIcon>
      )}
      <ActionIcon variant="subtle" color="gray" size="lg" className={styles.danger} onClick={remove} aria-label="Удалить">
        <Trash2 size={16} />
      </ActionIcon>
    </Group>
  );
}
