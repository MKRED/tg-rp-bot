import { Button, Input } from "@telegram-apps/telegram-ui";
import { useState } from "react";
import { DeleteButton } from "../../../shared/components/DeleteButton";
import { useUnsavedChangesGuard } from "../../../shared/telegram/useUnsavedChangesGuard";
import type { CardInput } from "../types/card";

interface CardFormProps {
  /** Начальные значения (режим редактирования); отсутствуют — режим создания. */
  initial?: CardInput;
  submitting: boolean;
  /** Промис нужен, чтобы форма знала об успехе и сбросила «грязный» снапшот — окно после
   * сохранения не закрывается, а показывает уведомление (см. CardEditPage). */
  onSubmit: (input: CardInput) => Promise<void>;
  /** Удаление доступно только при редактировании. */
  onDelete?: () => void;
}

/** Форма создания/редактирования карточки. Пока одно поле — имя; растёт следующими этапами. */
export function CardForm({ initial, submitting, onSubmit, onDelete }: CardFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  // Снапшот последнего сохранённого имени — база для «грязного» статуса. Обновляется после
  // каждого успешного сохранения (окно не закрывается, см. handleSubmit).
  const [baseline, setBaseline] = useState(initial?.name.trim() ?? "");
  const isDirty = name.trim() !== baseline;
  useUnsavedChangesGuard(isDirty);

  const canSubmit = name.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const trimmed = name.trim();
    try {
      await onSubmit({ name: trimmed });
      setBaseline(trimmed);
    } catch {
      // Ошибку показывает CardEditPage (тост) — здесь просто не сбрасываем baseline,
      // чтобы «несохранённые изменения» и confirm на уходе продолжали действовать.
    }
  };

  return (
    <div className="card-form">
      <Input
        header="Название"
        placeholder="Название карточки"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <div className="card-form__actions">
        {isDirty && !submitting && <span className="card-form__unsaved">Есть несохранённые изменения</span>}
        <Button size="l" stretched disabled={!canSubmit} onClick={handleSubmit}>
          {submitting ? "Сохранение…" : "Сохранить"}
        </Button>
        {onDelete && (
          <DeleteButton disabled={submitting} onClick={onDelete}>
            Удалить карточку
          </DeleteButton>
        )}
      </div>
    </div>
  );
}
