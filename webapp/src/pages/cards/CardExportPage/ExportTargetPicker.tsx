import { Cell, List, Modal, Spinner } from "@telegram-apps/telegram-ui";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

export interface ExportTargetOption {
  id: number;
  name: string;
  subtitle?: string;
  hasImage: boolean;
}

interface ExportTargetPickerProps {
  modalTitle: string;
  placeholder: string;
  emptyHint: string;
  /** Иконка-заглушка, пока запись не выбрана — своя для персонажа/персоны (см. вызов в ExportTargetSection). */
  icon: ReactNode;
  options: ExportTargetOption[];
  loading: boolean;
  targetId: number | null;
  onChange: (id: number) => void;
  renderAvatar: (option: ExportTargetOption) => ReactNode;
}

/**
 * Выбор существующей записи (персонажа/персоны) для обновления при выгрузке карточки — тот же
 * Cell+Modal+List паттерн, что у выбора персонажа/персоны/пресета в RpChatNewPage и PresetPicker
 * (CardForm): триггер — обычный Cell с onClick (а не ButtonCell — тот не поддерживает subtitle,
 * которым здесь показан статус выбора). Аватар рисует вызывающая сторона (renderAvatar) —
 * CharacterAvatar/PersonaAvatar живут каждый в своей фиче, эта форма их напрямую не импортирует.
 */
export function ExportTargetPicker({
  modalTitle,
  placeholder,
  emptyHint,
  icon,
  options,
  loading,
  targetId,
  onChange,
  renderAvatar,
}: ExportTargetPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === targetId) ?? null;

  return (
    <>
      <Cell
        before={selected ? renderAvatar(selected) : icon}
        after={<ChevronRight size={20} className="card-form__chevron" />}
        subtitle={selected ? (selected.subtitle ?? modalTitle) : "Не выбрано"}
        onClick={() => setOpen(true)}
      >
        {selected?.name ?? placeholder}
      </Cell>

      <Modal open={open} onOpenChange={setOpen} header={<Modal.Header>{modalTitle}</Modal.Header>}>
        {loading && (
          <div className="card-form__center">
            <Spinner size="m" />
          </div>
        )}
        {!loading && options.length === 0 && <Cell subtitle={emptyHint}>Ничего не найдено</Cell>}
        <List>
          {options.map((o) => (
            <Cell
              key={o.id}
              before={renderAvatar(o)}
              subtitle={o.subtitle}
              onClick={() => {
                onChange(o.id);
                setOpen(false);
              }}
            >
              {o.name}
            </Cell>
          ))}
        </List>
      </Modal>
    </>
  );
}
