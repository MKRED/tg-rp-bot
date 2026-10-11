import { ActionIcon, TextInput } from "@mantine/core";
import { Check, Trash2 } from "lucide-react";

interface ApiKeyFieldProps {
  label: string;
  /** Статус под подписью: «Ключ сохранён, оканчивается на …» / «Ключ не задан». */
  description: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  /** Есть ли сохранённый ключ: при пустом поле кнопка справа удаляет его. */
  hasKey: boolean;
  /** Идёт проверка/сохранение — кнопка показывает лоадер и не нажимается. */
  busy: boolean;
  onSave: () => void;
  onDelete: () => void;
}

/**
 * Поле персонального ключа API (BYOK). Кнопка справа условная: пока в поле что-то введено — проверить
 * и сохранить ключ; поле пустое, а ключ сохранён — удалить его; иначе кнопки нет. Сам ключ с сервера
 * не приходит — поле всегда начинается пустым.
 */
export function ApiKeyField({
  label,
  description,
  placeholder,
  value,
  onChange,
  hasKey,
  busy,
  onSave,
  onDelete,
}: ApiKeyFieldProps) {
  const action = value.trim() ? "save" : hasKey ? "delete" : null;

  return (
    <TextInput
      type="password"
      label={label}
      description={description}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      autoComplete="off"
      rightSectionWidth={48}
      rightSection={
        action && (
          <ActionIcon
            size="lg"
            variant="light"
            color={action === "delete" ? "red" : undefined}
            loading={busy}
            onClick={action === "save" ? onSave : onDelete}
            aria-label={action === "save" ? "Сохранить ключ" : "Удалить ключ"}
          >
            {action === "save" ? <Check size={18} /> : <Trash2 size={18} />}
          </ActionIcon>
        )
      }
    />
  );
}
