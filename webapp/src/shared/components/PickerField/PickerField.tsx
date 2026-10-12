import { Input, Loader, Text, UnstyledButton } from "@mantine/core";
import { Check, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ListRow } from "../ListCard";
import { ResponsiveSheet } from "../ResponsiveSheet";
import styles from "./PickerField.module.css";

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
  onChange,
}: PickerFieldProps) {
  const [opened, setOpened] = useState(false);
  const selected = selectedOverride !== undefined ? selectedOverride : (options.find((o) => o.id === value) ?? null);

  return (
    <>
      {/* size md — подпись того же размера, что у полей ввода (их размер задан в теме). */}
      <Input.Wrapper label={label} description={description} withAsterisk={required} size="md">
        <UnstyledButton className={styles.field} onClick={() => setOpened(true)} aria-haspopup="dialog">
          {selected?.leading}
          <div className={styles.text}>
            <Text c={selected ? undefined : "dimmed"} truncate>
              {selected?.title ?? placeholder}
            </Text>
            {selected?.description && (
              <Text size="sm" c="dimmed" truncate>
                {selected.description}
              </Text>
            )}
          </div>
          <ChevronRight size={18} className={styles.chevron} aria-hidden />
        </UnstyledButton>
      </Input.Wrapper>

      <ResponsiveSheet opened={opened} onClose={() => setOpened(false)} title={label}>
        {loading ? (
          <div className={styles.center}>
            <Loader size="sm" />
          </div>
        ) : options.length === 0 ? (
          <Text c="dimmed" ta="center" py="md">
            {emptyText}
          </Text>
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
