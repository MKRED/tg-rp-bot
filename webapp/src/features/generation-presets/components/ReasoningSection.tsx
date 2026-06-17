import { EffortPicker } from "./EffortPicker";
import { SwitchRow } from "./SwitchRow";
import { type ReasoningEffort } from "../types/preset";

interface ReasoningSectionProps {
  requestReasoning: boolean;
  reasoningEffort: ReasoningEffort;
  onRequestReasoning: (value: boolean) => void;
  onReasoningEffort: (value: ReasoningEffort) => void;
}

/** Секция рассуждения: тумблер «запрашивать рассуждение» + выбор уровня (виден при включении). */
export function ReasoningSection({
  requestReasoning,
  reasoningEffort,
  onRequestReasoning,
  onReasoningEffort,
}: ReasoningSectionProps) {
  return (
    <>
      <SwitchRow
        label="Запрашивать рассуждение"
        hint="Просит модель «думать» перед ответом (только для reasoning-моделей)."
        checked={requestReasoning}
        onChange={onRequestReasoning}
      />
      {requestReasoning && <EffortPicker value={reasoningEffort} onChange={onReasoningEffort} />}
    </>
  );
}
