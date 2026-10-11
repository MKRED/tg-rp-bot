import { UnstyledButton } from "@mantine/core";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./ChoiceCard.module.css";

interface ChoiceCardProps {
  selected: boolean;
  onSelect: () => void;
  /** Подпись для скринридера, если видимого текста нет или он неполный. */
  ariaLabel?: string;
  /** Roving tabindex от useChoiceGroup: в Tab-порядке только выбранный вариант. */
  tabIndex?: number;
  children: ReactNode;
}

/**
 * Вариант в выборе «один из нескольких» с визуальным превью (палитра, шрифт). Выбранный обведён
 * акцентом и отмечен галочкой. Роль radio — группа оборачивается useChoiceGroup (radiogroup, стрелки).
 */
export function ChoiceCard({ selected, onSelect, ariaLabel, tabIndex, children }: ChoiceCardProps) {
  return (
    <UnstyledButton
      className={styles.card}
      role="radio"
      aria-checked={selected}
      aria-label={ariaLabel}
      tabIndex={tabIndex}
      data-selected={selected || undefined}
      onClick={onSelect}
    >
      {children}
      {selected && (
        <span className={styles.check} aria-hidden>
          <Check size={12} strokeWidth={3} />
        </span>
      )}
    </UnstyledButton>
  );
}
