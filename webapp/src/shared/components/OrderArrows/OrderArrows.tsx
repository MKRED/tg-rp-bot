import { ActionIcon } from "@mantine/core";
import { ChevronDown, ChevronUp } from "lucide-react";
import styles from "./OrderArrows.module.css";

interface OrderArrowsProps {
  /** Позиция в списке и его длина — крайние стрелки выключены. */
  index: number;
  count: number;
  /** Что двигаем — для aria-label («Анна: выше»). */
  label: string;
  onMove: (dir: -1 | 1) => void;
}

/** Стрелки ↑/↓ перестановки элемента списка: кнопки 44px, недоступная — бледная без плашки. */
export function OrderArrows({ index, count, label, onMove }: OrderArrowsProps) {
  return (
    <div className={styles.root}>
      <ActionIcon
        variant="subtle"
        color="gray"
        size="xl"
        className={styles.arrow}
        aria-label={`${label}: выше`}
        disabled={index === 0}
        onClick={() => onMove(-1)}
      >
        <ChevronUp size={20} />
      </ActionIcon>
      <ActionIcon
        variant="subtle"
        color="gray"
        size="xl"
        className={styles.arrow}
        aria-label={`${label}: ниже`}
        disabled={index === count - 1}
        onClick={() => onMove(1)}
      >
        <ChevronDown size={20} />
      </ActionIcon>
    </div>
  );
}
