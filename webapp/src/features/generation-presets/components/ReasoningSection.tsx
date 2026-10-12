import { Collapse, Select, Switch } from "@mantine/core";
import { SettingsCard } from "../../../shared/components/SettingsCard";
import { REASONING_EFFORTS, REASONING_EFFORT_LABELS, type ReasoningEffort } from "../types/preset";

const EFFORT_OPTIONS = REASONING_EFFORTS.map((effort) => ({
  value: effort,
  label: REASONING_EFFORT_LABELS[effort],
}));

interface ReasoningSectionProps {
  requestReasoning: boolean;
  reasoningEffort: ReasoningEffort;
  onRequestReasoning: (value: boolean) => void;
  onReasoningEffort: (value: ReasoningEffort) => void;
}

/** Карточка «Рассуждение»: тумблер «запрашивать» + уровень (раскрывается при включении). */
export function ReasoningSection({
  requestReasoning,
  reasoningEffort,
  onRequestReasoning,
  onReasoningEffort,
}: ReasoningSectionProps) {
  return (
    <SettingsCard title="Рассуждение">
      {/* Отступ над списком — внутри Collapse, а не gap карточки: иначе в свёрнутом виде под
          тумблером оставалась бы пустая полоса. */}
      <div>
        <Switch
          label="Запрашивать рассуждение"
          description="Модель «думает» перед ответом (только reasoning-модели)."
          checked={requestReasoning}
          onChange={(e) => onRequestReasoning(e.currentTarget.checked)}
        />
        <Collapse expanded={requestReasoning}>
          <Select
            pt="md"
            label="Уровень рассуждения"
            data={EFFORT_OPTIONS}
            value={reasoningEffort}
            // Значение обязательно: при включённом рассуждении уровень уходит в запрос.
            allowDeselect={false}
            onChange={(v) => v && onReasoningEffort(v as ReasoningEffort)}
          />
        </Collapse>
      </div>
    </SettingsCard>
  );
}
