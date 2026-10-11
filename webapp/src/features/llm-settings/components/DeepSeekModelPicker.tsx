import { Loader, Select } from "@mantine/core";

interface DeepSeekModelPickerProps {
  value: string | null;
  options: string[];
  onChange: (value: string) => void;
  /** Раскрытие списка запускает (ре)проверку ключа — так подтягивается актуальный список моделей. */
  onOpen: () => void;
  /** Идёт загрузка списка моделей. */
  pending: boolean;
  disabled?: boolean;
}

/**
 * Выбор модели DeepSeek. options приходят из GET /models (useLlmSettings.verify) — заранее неизвестны,
 * поэтому список динамический; до первой проверки в нём только сохранённая модель.
 */
export function DeepSeekModelPicker({ value, options, onChange, onOpen, pending, disabled }: DeepSeekModelPickerProps) {
  return (
    <Select
      label="Модель"
      description={pending ? "Загрузка моделей…" : "Список моделей приходит от DeepSeek при открытии"}
      placeholder="Модель не выбрана"
      data={options}
      value={value}
      onChange={(next) => next && onChange(next)}
      onDropdownOpen={onOpen}
      allowDeselect={false}
      disabled={disabled}
      rightSection={pending ? <Loader size={16} /> : undefined}
      aria-label="Модель DeepSeek"
    />
  );
}
