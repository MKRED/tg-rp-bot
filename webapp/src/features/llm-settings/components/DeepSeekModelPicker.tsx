import { DropdownPicker } from "../../../shared/components/DropdownPicker";

interface DeepSeekModelPickerProps {
  header: string;
  subtitle?: string;
  value: string | null;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  onOpen?: () => void;
  pending?: boolean;
}

/**
 * Выпадающий список моделей DeepSeek — тонкая обёртка над общим DropdownPicker. options приходят
 * из GET /models (см. useLlmSettings.verify) — заранее неизвестны и потенциально длинные, поэтому
 * список динамический, а не константа, как в EffortPicker. onOpen/pending — раскрытие списка само
 * запускает (ре)проверку ключа и подтягивает актуальный список моделей.
 */
export function DeepSeekModelPicker({
  header,
  subtitle,
  value,
  options,
  onChange,
  disabled,
  className,
  onOpen,
  pending,
}: DeepSeekModelPickerProps) {
  return (
    <DropdownPicker
      className={className}
      header={header}
      subtitle={subtitle}
      value={value}
      options={options.map((model) => ({ value: model, label: model }))}
      onChange={onChange}
      placeholder="Модель не выбрана"
      disabled={disabled}
      ariaLabel="Модель DeepSeek"
      onOpen={onOpen}
      pending={pending}
    />
  );
}
