import { Loader, Text } from "@mantine/core";
import { BookOpen, List, PenLine, Search } from "lucide-react";
import { stepLabel } from "../../lib/steps";
import type { CoauthorCard, CoauthorStep } from "../../types/coauthor";
import styles from "./CoauthorFeed.module.css";

const ICONS = { cards: List, card: BookOpen, search: Search, edit: PenLine } as const;

interface StepsListProps {
  steps: CoauthorStep[];
  cards: CoauthorCard[];
}

/** Шаги хода ИИ. Неудачные вызовы не показываем: модель получает ошибку и исправляется сама, это не событие для пользователя. */
export function StepsList({ steps, cards }: StepsListProps) {
  const visible = steps.filter((s) => s.status !== "failed");
  if (visible.length === 0) return null;
  return (
    <ul className={styles.steps}>
      {visible.map((step) => {
        const Icon = ICONS[step.kind];
        return (
          <li key={step.id} className={styles.step}>
            <span className={styles.stepIcon}>{step.status === "running" ? <Loader size={14} /> : <Icon size={14} aria-hidden />}</span>
            <Text size="sm" c={step.status === "running" ? undefined : "dimmed"} className={styles.stepLabel}>
              {stepLabel(step, cards)}
            </Text>
          </li>
        );
      })}
    </ul>
  );
}
