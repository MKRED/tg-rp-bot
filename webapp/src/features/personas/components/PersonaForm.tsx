import { Button, Input } from "@telegram-apps/telegram-ui";
import { useMemo, useState } from "react";
import { AvatarPicker, type AvatarValue } from "../../../shared/components/AvatarPicker";
import { DeleteButton } from "../../../shared/components/DeleteButton";
import { PromptEditorField } from "../../../shared/components/PromptEditorField";
import { useUnsavedChangesGuard } from "../../../shared/telegram/useUnsavedChangesGuard";
import { hasUnsavedChanges, normalizePersonaDraft } from "../lib/formDirty";
import type { PersonaInput } from "../types/persona";

interface PersonaFormProps {
  /** Начальные значения (режим редактирования); отсутствуют — режим создания. */
  initial?: PersonaInput;
  submitting: boolean;
  /** Промис нужен, чтобы форма знала об успехе и сбросила «грязный» снапшот — окно после
   * сохранения не закрывается, а показывает уведомление (см. PersonaEditPage). */
  onSubmit: (input: PersonaInput) => Promise<void>;
  /** Удаление доступно только при редактировании. */
  onDelete?: () => void;
}

/** Форма создания/редактирования персоны. Состояние держим локально (паттерн Composer). */
export function PersonaForm({ initial, submitting, onSubmit, onDelete }: PersonaFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [image, setImage] = useState<string | null>(initial?.image ?? null);
  const [imageFull, setImageFull] = useState<string | null>(initial?.imageFull ?? null);
  const [footnote, setFootnote] = useState(initial?.footnote ?? "");
  const [prompt, setPrompt] = useState(initial?.prompt ?? "");

  // Снапшот «последних сохранённых» значений (изначально — initial, пустой объект в режиме
  // создания) — база для сравнения при определении несохранённых правок. Обновляется после
  // каждого успешного сохранения (см. handleSubmit): окно не закрывается, поэтому initial-проп
  // не меняется, а «грязный» статус должен сброситься сам.
  const [baseline, setBaseline] = useState<PersonaInput>(() =>
    normalizePersonaDraft({
      name: initial?.name ?? "",
      image: initial?.image ?? null,
      imageFull: initial?.imageFull ?? null,
      footnote: initial?.footnote ?? "",
      prompt: initial?.prompt ?? "",
    }),
  );
  const isDirty = useMemo(
    () => hasUnsavedChanges({ name, image, imageFull, footnote, prompt }, baseline),
    [name, image, imageFull, footnote, prompt, baseline],
  );
  useUnsavedChangesGuard(isDirty);

  const canSubmit = name.trim().length > 0 && !submitting;

  // Аватар: выбор фото даёт обе картинки, удаление — null.
  const handleAvatar = (value: AvatarValue | null) => {
    setImage(value?.image ?? null);
    setImageFull(value?.imageFull ?? null);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const payload = normalizePersonaDraft({ name, image, imageFull, footnote, prompt });
    try {
      await onSubmit(payload);
      // Сброс «грязного» статуса на реально сохранённые значения — форма остаётся открытой.
      setBaseline(payload);
    } catch {
      // Ошибку показывает PersonaEditPage (тост) — здесь просто не сбрасываем baseline,
      // чтобы «несохранённые изменения» и confirm на уходе продолжали действовать.
    }
  };

  return (
    <div className="persona-form">
      <AvatarPicker image={image} imageFull={imageFull} name={name} onChange={handleAvatar} />

      <Input
        header="Имя"
        placeholder="Имя персоны"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <Input
        header="Сноска"
        placeholder="Заметка для себя (не влияет на чат)"
        value={footnote}
        onChange={(e) => setFootnote(e.target.value)}
      />

      <PromptEditorField
        header="Промпт"
        placeholder="Описание персоны для нейросети…"
        value={prompt}
        onChange={setPrompt}
      />

      <div className="persona-form__actions">
        {isDirty && !submitting && <span className="persona-form__unsaved">Есть несохранённые изменения</span>}
        <Button size="l" stretched disabled={!canSubmit} onClick={handleSubmit}>
          {submitting ? "Сохранение…" : "Сохранить"}
        </Button>
        {onDelete && (
          <DeleteButton disabled={submitting} onClick={onDelete}>
            Удалить персону
          </DeleteButton>
        )}
      </div>
    </div>
  );
}
