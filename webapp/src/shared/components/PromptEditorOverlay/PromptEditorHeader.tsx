import { Button, Text, UnstyledButton } from "@mantine/core";
import { ChevronDown } from "lucide-react";
import styles from "./PromptEditorOverlay.module.css";

interface PromptEditorHeaderProps {
  title: string;
  dirty: boolean;
  toolbarVisible: boolean;
  onToggleToolbar: () => void;
  onDiscard: () => void;
  onSave: () => void;
}

/** Шапка редактора: Отмена / заголовок (тап раскрывает панель инструментов) / Готово. */
export function PromptEditorHeader({
  title,
  dirty,
  toolbarVisible,
  onToggleToolbar,
  onDiscard,
  onSave,
}: PromptEditorHeaderProps) {
  return (
    <div className={styles.header}>
      <Button variant="subtle" color="gray" onClick={onDiscard} flex="none">
        Отмена
      </Button>
      <UnstyledButton
        className={styles.titleToggle}
        onClick={onToggleToolbar}
        aria-expanded={toolbarVisible}
        aria-label={toolbarVisible ? "Скрыть инструменты" : "Показать инструменты"}
      >
        <Text fw={600} truncate>
          {title}
        </Text>
        {/* Шеврон подсказывает, что заголовок нажимается; поворот — что панель открыта. */}
        <ChevronDown size={16} className={styles.chevron} data-open={toolbarVisible || undefined} aria-hidden />
      </UnstyledButton>
      <Button disabled={!dirty} onClick={onSave} flex="none">
        Готово
      </Button>
    </div>
  );
}
