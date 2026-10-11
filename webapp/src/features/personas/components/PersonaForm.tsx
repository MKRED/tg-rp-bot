import { Button, Paper, Stack, Text, TextInput } from "@mantine/core";
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
    <Stack gap="lg">
      <Paper p="md">
        <Stack gap="md">
          <AvatarPicker image={image} imageFull={imageFull} name={name} onChange={handleAvatar} />
          <TextInput
            label="Имя"
            placeholder="Имя персоны"
            withAsterisk
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />
          <TextInput
            label="Сноска"
            description="Заметка для себя — в чат не попадает"
            placeholder="Например, «для фэнтези-чатов»"
            value={footnote}
            onChange={(e) => setFootnote(e.currentTarget.value)}
          />
          <PromptEditorField
            header="Промпт"
            hint="Описание персоны для нейросети: кто вы в этом чате, внешность, характер."
            placeholder="Описание персоны для нейросети…"
            value={prompt}
            onChange={setPrompt}
          />
        </Stack>
      </Paper>

      <Stack gap="sm">
        {isDirty && !submitting && (
          <Text size="sm" c="dimmed" ta="center">
            Есть несохранённые изменения
          </Text>
        )}
        <Button fullWidth disabled={!canSubmit} loading={submitting} onClick={handleSubmit}>
          Сохранить
        </Button>
        {onDelete && (
          <DeleteButton disabled={submitting} onClick={onDelete}>
            Удалить персону
          </DeleteButton>
        )}
      </Stack>
    </Stack>
  );
}
