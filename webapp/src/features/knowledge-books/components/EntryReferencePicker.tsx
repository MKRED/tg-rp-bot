import { Cell, List, Modal } from "@telegram-apps/telegram-ui";
import { ChevronRight } from "lucide-react";
import type { ComponentType } from "react";

interface ReferenceItem {
  id: number;
  name: string;
  hasImage: boolean;
}

interface EntryReferencePickerProps {
  items: ReferenceItem[];
  selected: ReferenceItem | null;
  /** CharacterAvatar/PersonaAvatar — оба с одинаковой сигнатурой пропсов. */
  Avatar: ComponentType<{
    id: number;
    hasImage: boolean;
    name: string;
    size?: 20 | 24 | 28 | 40 | 48 | 96;
  }>;
  modalTitle: string;
  typeLabel: string;
  emptyLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: number) => void;
}

/**
 * Cell-триггер + Modal со списком выбора — общий паттерн для ссылочных записей книги знаний
 * (персонаж/персона): обе ветки отличаются только источником данных и компонентом аватара.
 */
export function EntryReferencePicker({
  items,
  selected,
  Avatar,
  modalTitle,
  typeLabel,
  emptyLabel,
  open,
  onOpenChange,
  onSelect,
}: EntryReferencePickerProps) {
  return (
    <>
      <Cell
        before={
          selected ? <Avatar id={selected.id} hasImage={selected.hasImage} name={selected.name} size={40} /> : undefined
        }
        after={<ChevronRight size={20} style={{ opacity: 0.4 }} />}
        subtitle={selected ? typeLabel : "Обязательно"}
        onClick={() => onOpenChange(true)}
      >
        {selected?.name ?? emptyLabel}
      </Cell>

      <Modal open={open} onOpenChange={onOpenChange} header={<Modal.Header>{modalTitle}</Modal.Header>}>
        <List>
          {items.map((item) => (
            <Cell
              key={item.id}
              before={<Avatar id={item.id} hasImage={item.hasImage} name={item.name} size={40} />}
              onClick={() => {
                onSelect(item.id);
                onOpenChange(false);
              }}
            >
              {item.name}
            </Cell>
          ))}
        </List>
      </Modal>
    </>
  );
}
