import { Loader, Select } from "@mantine/core";

interface DeepSeekModelPickerProps {
  value: string;
  /** Модели от DeepSeek; null — список не получен (тогда в выборе только текущая модель). */
  models: string[] | null;
  loading: boolean;
  noKey: boolean;
  onChange: (value: string) => void;
}

/** Описание под полем: что сейчас со списком моделей. */
function describe(loading: boolean, noKey: boolean, models: string[] | null): string {
  if (loading) return "Загрузка моделей…";
  if (noKey) return "Добавьте ключ DeepSeek в настройках, чтобы выбрать модель.";
  if (!models) return "Не удалось получить список моделей.";
  return "Список приходит от DeepSeek по вашему ключу.";
}

/**
 * Выбор модели DeepSeek в пресете. Список динамический (GET /models через verify), поэтому текущую
 * модель добавляем в варианты сами — иначе, пока список грузится или если DeepSeek её убрал, Select
 * показал бы пустое поле.
 */
export function DeepSeekModelPicker({ value, models, loading, noKey, onChange }: DeepSeekModelPickerProps) {
  const options = models?.includes(value) ? models : [value, ...(models ?? [])];
  return (
    <Select
      label="Модель"
      description={describe(loading, noKey, models)}
      data={options}
      value={value}
      onChange={(next) => next && onChange(next)}
      allowDeselect={false}
      rightSection={loading ? <Loader size={16} /> : undefined}
    />
  );
}
