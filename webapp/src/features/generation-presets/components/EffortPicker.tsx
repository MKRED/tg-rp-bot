import { DropdownPicker } from "../../../shared/components/DropdownPicker";
import { REASONING_EFFORTS, REASONING_EFFORT_LABELS, type ReasoningEffort } from "../types/preset";

interface EffortPickerProps {
  value: ReasoningEffort;
  onChange: (value: ReasoningEffort) => void;
}

const OPTIONS = REASONING_EFFORTS.map((effort) => ({
  value: effort,
  label: REASONING_EFFORT_LABELS[effort],
}));

/** Выпадающий список уровня рассуждения — тонкая обёртка над общим DropdownPicker. */
export function EffortPicker({ value, onChange }: EffortPickerProps) {
  return (
    <DropdownPicker
      className="preset-picker-gutter"
      header="Уровень рассуждения"
      value={value}
      options={OPTIONS}
      onChange={onChange}
      ariaLabel="Уровень рассуждения"
    />
  );
}
