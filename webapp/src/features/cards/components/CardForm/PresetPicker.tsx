import { Cell, List, Modal, Spinner } from "@telegram-apps/telegram-ui";
import { ChevronRight, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import type { CardPresetOption } from "../../types/card";

interface PresetPickerProps {
  presets: CardPresetOption[];
  loading: boolean;
  presetId: number | null;
  onChange: (id: number) => void;
}

/**
 * Выбор пресета ИИ для генерации блоков карточки — Cell+Modal, тот же паттерн, что у выбора
 * пресета в RpChatNewPage. Данные (список/загрузка) приходят пропсами — фича cards не тянет
 * generation-presets напрямую (границы фичи), их подтягивает страница (CardEditPage).
 */
export function PresetPicker({ presets, loading, presetId, onChange }: PresetPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = presets.find((p) => p.id === presetId) ?? null;

  return (
    <>
      <Cell
        before={
          <SlidersHorizontal
            size={24}
            className={`card-form__icon${presetId === null ? " card-form__icon--hint" : ""}`}
          />
        }
        after={<ChevronRight size={20} className="card-form__chevron" />}
        subtitle={presetId === null ? "Нужен для генерации блоков" : (selected?.summary ?? "Пресет ИИ")}
        onClick={() => setOpen(true)}
      >
        {selected?.name ?? "Выберите пресет ИИ"}
      </Cell>

      <Modal open={open} onOpenChange={setOpen} header={<Modal.Header>Пресет ИИ</Modal.Header>}>
        {loading && (
          <div className="card-form__center">
            <Spinner size="m" />
          </div>
        )}
        {!loading && presets.length === 0 && <Cell subtitle="Сначала создайте пресет">Нет пресетов</Cell>}
        <List>
          {presets.map((p) => (
            <Cell
              key={p.id}
              subtitle={p.summary}
              onClick={() => {
                onChange(p.id);
                setOpen(false);
              }}
            >
              {p.name}
            </Cell>
          ))}
        </List>
      </Modal>
    </>
  );
}
