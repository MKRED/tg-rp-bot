import { ActionIcon, Divider } from "@mantine/core";
import { Check, ClipboardPaste, Copy, Languages, Redo2, Trash2, Undo2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./PromptEditorOverlay.module.css";

interface PromptEditorToolbarProps {
  draft: string;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  /** Текст уже прочитан из буфера обмена — вставка на месте курсора остаётся за родителем (он держит ref поля). */
  onPaste: (text: string) => void;
  /** Очистка недоступна, пока в поле буфер перевода (см. PromptEditorBody). */
  clearDisabled?: boolean;
  /** Переключает панель на PromptEditorTranslateToolbar (второй режим). */
  onOpenTranslate: () => void;
}

const ICON = 20;

/**
 * Панель работы с текстом — сама читает/пишет буфер обмена (единственное место clipboard-вызовов),
 * а вставку на месте курсора и историю undo/redo делегирует родителю.
 */
export function PromptEditorToolbar({
  draft,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  onPaste,
  clearDisabled,
  onOpenTranslate,
}: PromptEditorToolbarProps) {
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (copiedTimer.current) clearTimeout(copiedTimer.current); }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard
      .writeText(draft)
      .then(() => {
        setCopied(true);
        if (copiedTimer.current) clearTimeout(copiedTimer.current);
        copiedTimer.current = setTimeout(() => setCopied(false), 1500);
      })
      .catch((err) => console.error("Не удалось скопировать текст промпта", err));
  }, [draft]);

  const handlePaste = useCallback(() => {
    navigator.clipboard
      .readText()
      .then((text) => {
        if (text) onPaste(text);
      })
      .catch((err) => console.error("Не удалось прочитать буфер обмена", err));
  }, [onPaste]);

  return (
    <div className={styles.toolbar}>
      <ActionIcon
        variant="subtle"
        className={styles.tool}
        color="red"
        size="lg"
        onClick={onClear}
        disabled={!draft || clearDisabled}
        aria-label="Очистить текст"
      >
        <Trash2 size={ICON} />
      </ActionIcon>

      <Divider orientation="vertical" mx={4} />

      <ActionIcon variant="subtle" className={styles.tool} color="gray" size="lg" onClick={handleCopy} disabled={!draft} aria-label="Скопировать">
        {copied ? <Check size={ICON} /> : <Copy size={ICON} />}
      </ActionIcon>
      <ActionIcon variant="subtle" className={styles.tool} color="gray" size="lg" onClick={handlePaste} aria-label="Вставить">
        <ClipboardPaste size={ICON} />
      </ActionIcon>
      <ActionIcon variant="subtle" className={styles.tool} color="gray" size="lg" onClick={onOpenTranslate} aria-label="Режим перевода">
        <Languages size={ICON} />
      </ActionIcon>

      {/* Undo/Redo прижаты к правому краю панели. */}
      <ActionIcon
        variant="subtle"
        className={styles.tool}
        color="gray"
        size="lg"
        ml="auto"
        onClick={onUndo}
        disabled={!canUndo}
        aria-label="Отменить"
      >
        <Undo2 size={ICON} />
      </ActionIcon>
      <ActionIcon variant="subtle" className={styles.tool} color="gray" size="lg" onClick={onRedo} disabled={!canRedo} aria-label="Повторить">
        <Redo2 size={ICON} />
      </ActionIcon>
    </div>
  );
}
