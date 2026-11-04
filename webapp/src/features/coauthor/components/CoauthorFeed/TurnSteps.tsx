import { Collapse, Text, UnstyledButton } from "@mantine/core";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { pluralRu } from "../../../../shared/text/pluralRu";
import type { CoauthorCard, CoauthorStep } from "../../types/coauthor";
import { StepsList } from "./StepsList";
import styles from "./CoauthorFeed.module.css";

interface TurnStepsProps {
  steps: CoauthorStep[];
  cards: CoauthorCard[];
}

/** Шаги завершённого хода: свёрнуты в строку, чтобы не мешать читать переписку, раскрываются по нажатию. */
export function TurnSteps({ steps, cards }: TurnStepsProps) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <UnstyledButton className={styles.stepsToggle} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Text size="xs" c="dimmed">
          Ход работы · {steps.length} {pluralRu(steps.length, ["шаг", "шага", "шагов"])}
        </Text>
        <ChevronDown size={14} className={styles.stepsChevron} data-open={open || undefined} aria-hidden />
      </UnstyledButton>
      <Collapse expanded={open}>
        <StepsList steps={steps} cards={cards} />
      </Collapse>
    </div>
  );
}
