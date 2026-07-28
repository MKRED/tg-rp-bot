import { DropdownPicker } from "../../../shared/components/DropdownPicker";

interface DeepSeekModelPickerProps {
  header: string;
  value: string | null;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * Выпадающий список моделей DeepSeek — тонкая обёртка над общим DropdownPicker. options приходят
 * из GET /models (см. useLlmSettings.verify) — заранее неизвестны и потенциально длинные, поэтому
 * список динамический, а не константа, как в EffortPicker.
 */
export function DeepSeekModelPicker({ header, value, options, onChange, disabled }: DeepSeekModelPickerProps) {
  return (
    <DropdownPicker
      header={header}
      value={value}
      options={options.map((model) => ({ value: model, label: model }))}
      onChange={onChange}
      placeholder="Модель не выбрана"
      disabled={disabled}
      ariaLabel="Модель DeepSeek"
    />
  );
}
