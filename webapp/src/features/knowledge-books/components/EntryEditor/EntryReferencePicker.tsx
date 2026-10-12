import { Input, Text, UnstyledButton } from "@mantine/core";
import { Check, ChevronRight } from "lucide-react";
import { useState, type ComponentType } from "react";
import { ListRow } from "../../../../shared/components/ListCard";
import { ResponsiveSheet } from "../../../../shared/components/ResponsiveSheet";
import type { ReferenceItem } from "../../lib/entryReference";
import styles from "./EntryReferencePicker.module.css";

interface EntryReferencePickerProps {
  /** Подпись поля и заголовок шторки: «Персонаж» / «Персона». */
  label: string;
  items: ReferenceItem[];
  selected: ReferenceItem | null;
  /** CharacterAvatar/PersonaAvatar — с одинаковой сигнатурой пропсов. */
  Avatar: ComponentType<{ id: number; hasImage: boolean; name: string; size?: 40 }>;
  placeholder: string;
  /** Текст шторки, когда выбирать не из чего. */
  emptyText: string;
  onSelect: (id: number) => void;
}

/**
 * Поле выбора ссылки записи (персонаж/персона): выглядит как заполненное поле ввода, по нажатию —
 * список на шторке (на ПК — окно). Обе ветки отличаются только источником данных и аватаром.
 */
export function EntryReferencePicker({
  label,
  items,
  selected,
  Avatar,
  placeholder,
  emptyText,
  onSelect,
}: EntryReferencePickerProps) {
  const [opened, setOpened] = useState(false);

  return (
    <>
      {/* size md — подпись того же размера, что у полей ввода (их размер задан в теме). */}
      <Input.Wrapper label={label} withAsterisk size="md">
        <UnstyledButton className={styles.field} onClick={() => setOpened(true)} aria-haspopup="dialog">
          {selected && <Avatar id={selected.id} hasImage={selected.hasImage} name={selected.name} size={40} />}
          <Text className={styles.name} c={selected ? undefined : "dimmed"} truncate>
            {selected?.name ?? placeholder}
          </Text>
          <ChevronRight size={18} className={styles.chevron} aria-hidden />
        </UnstyledButton>
      </Input.Wrapper>

      <ResponsiveSheet opened={opened} onClose={() => setOpened(false)} title={label}>
        {items.length === 0 ? (
          <Text c="dimmed" ta="center" py="md">
            {emptyText}
          </Text>
        ) : (
          // Строки во всю ширину шторки — фон нажатия и разделители до краёв.
          <div className={styles.list}>
            {items.map((item, i) => (
              <ListRow
                key={item.id}
                index={i}
                leading={<Avatar id={item.id} hasImage={item.hasImage} name={item.name} size={40} />}
                title={item.name}
                chevron={false}
                meta={
                  item.id === selected?.id && (
                    <Check size={18} className={styles.check} aria-label="Выбрано" />
                  )
                }
                onClick={() => {
                  onSelect(item.id);
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
