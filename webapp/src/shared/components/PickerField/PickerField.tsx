import { Button, Loader, Stack, Text } from "@mantine/core";
import { Check, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ListRow } from "../ListCard";
import { ResponsiveSheet } from "../ResponsiveSheet";
import styles from "./PickerField.module.css";
import { PickerTrigger } from "./PickerTrigger";

export interface PickerOption {
  id: number;
  title: string;
  description?: string;
  /** Аватар или иконка слева — и в поле, и в списке. */
  leading?: ReactNode;
}

interface PickerFieldProps {
  /** Подпись поля и заголовок шторки. */
  label: string;
  /** Пояснение под подписью. */
  description?: ReactNode;
  required?: boolean;
  /** Текст поля, пока ничего не выбрано. */
  placeholder: string;
  options: PickerOption[];
  value: number | null;
  /**
   * Что показать в поле, если выбранного нет в options (список ещё грузится, а имя известно из
   * сохранённой записи). По умолчанию — вариант из options с id === value.
   */
  selected?: PickerOption | null;
  loading?: boolean;
  /** Текст шторки, когда выбирать не из чего. */
  emptyText: string;
  /** Кнопка под пустым списком — уйти создавать запись (шторка закрывается). */
  emptyAction?: { label: string; onClick: () => void };
  onChange: (id: number) => void;
}

/**
 * Поле выбора одного варианта из списка: выглядит как заполненное поле ввода (аватар, название,
 * подпись), по нажатию — список на шторке (на ПК — окно). Для выбора персонажа, персоны, пресета.
 */
export function PickerField({
  label,
  description,
  required,
  placeholder,
  options,
  value,
  selected: selectedOverride,
  loading,
  emptyText,
  emptyAction,
  onChange,
}: PickerFieldProps) {
  const [opened, setOpened] = useState(false);
  const selected = selectedOverride !== undefined ? selectedOverride : (options.find((o) => o.id === value) ?? null);

  return (
    <>
      <PickerTrigger
        label={label}
        description={description}
        required={required}
        leading={selected?.leading}
        title={selected?.title}
        subtitle={selected?.description}
        placeholder={placeholder}
        onClick={() => setOpened(true)}
      />

      <ResponsiveSheet opened={opened} onClose={() => setOpened(false)} title={label}>
        {loading ? (
          <div className={styles.center}>
            <Loader size="sm" />
          </div>
        ) : options.length === 0 ? (
          <Stack align="center" gap="md" py="md">
            <Text c="dimmed" ta="center">
              {emptyText}
            </Text>
            {emptyAction && (
              <Button
                variant="light"
                leftSection={<Plus size={18} />}
                onClick={() => {
                  setOpened(false);
                  emptyAction.onClick();
                }}
              >
                {emptyAction.label}
              </Button>
            )}
          </Stack>
        ) : (
          // Строки во всю ширину шторки — фон нажатия и разделители до краёв.
          <div className={styles.list}>
            {options.map((o, i) => (
              <ListRow
                key={o.id}
                index={i}
                leading={o.leading}
                title={o.title}
                description={o.description}
                chevron={false}
                meta={o.id === value && <Check size={18} className={styles.check} aria-label="Выбрано" />}
                onClick={() => {
                  onChange(o.id);
                  setOpened(false);
                }}
              />
            ))}
          </div>
        )}
      </ResponsiveSheet>
    </>
  );
}
