import { Button, Stack, TextInput } from "@mantine/core";
import { useState } from "react";
import { DeleteButton } from "../../../../shared/components/DeleteButton";
import { PromptEditorField } from "../../../../shared/components/PromptEditorField";
import { SettingsCard } from "../../../../shared/components/SettingsCard";
import type { NarratorTemplate, NarratorTemplateInput } from "../../types/template";
import { AssemblyCard } from "./AssemblyCard";
import { type SetDraftField, toDraft } from "./draft";
import { TranslationCard } from "./TranslationCard";

/** Подсказка-плейсхолдер: что писать в нарратор-инструкции (дефолт применяется, если оставить пусто). */
const SYSTEM_PLACEHOLDER =
  "Напр.: Ты рассказчик. Веди сцену, озвучивай всех персонажей, не пиши за пользователя. Заканчивай каждый бит на крючке. (Пусто → применится встроенный дефолт.)";

interface TemplateFormProps {
  initial?: NarratorTemplate;
  submitting: boolean;
  onSubmit: (input: NarratorTemplateInput) => void;
  onDelete?: () => void;
}

/**
 * Форма narrator-шаблона: название и промпты здесь, перевод и сборка запроса — отдельными карточками
 * (TranslationCard, AssemblyCard). Всё состояние — один черновик, карточки меняют его через set.
 */
export function TemplateForm({ initial, submitting, onSubmit, onDelete }: TemplateFormProps) {
  const [draft, setDraft] = useState(() => toDraft(initial));
  const set: SetDraftField = (key, value) => setDraft((d) => ({ ...d, [key]: value }));

  // Маркеры обязательны: пустой ломал бы сборку истории (см. docs/narrator.md).
  const valid =
    draft.name.trim().length > 0 && draft.continueMarker.trim().length > 0 && draft.leadingUserMarker.trim().length > 0;

  const submit = () =>
    onSubmit({
      ...draft,
      name: draft.name.trim(),
      continueMarker: draft.continueMarker.trim(),
      leadingUserMarker: draft.leadingUserMarker.trim(),
    });

  return (
    <Stack gap="lg">
      <SettingsCard title="Основное">
        <TextInput
          label="Название"
          placeholder="Напр. «Кинематографичный рассказчик»"
          withAsterisk
          value={draft.name}
          onChange={(e) => set("name", e.currentTarget.value)}
        />
      </SettingsCard>

      <SettingsCard title="Промпты" description="Как рассказчик ведёт сцену в режиме «Режиссёр истории».">
        <PromptEditorField
          header="Инструкция нарратора"
          hint="Системный промпт для режима «Режиссёр истории»: задаёт роль рассказчика, стиль и правила ведения сцены. Пусто → применится встроенный дефолт."
          placeholder={SYSTEM_PLACEHOLDER}
          previewLines={6}
          value={draft.systemPrompt}
          onChange={(v) => set("systemPrompt", v)}
        />
        <PromptEditorField
          header="Вспомогательный системный промпт"
          hint="Дополнительные указания поверх основного — например, формат или ограничения."
          value={draft.auxiliarySystemPrompt}
          onChange={(v) => set("auxiliarySystemPrompt", v)}
        />
        <PromptEditorField
          header="После истории (необязательно)"
          hint="Доп. инструкция, вставляемая после истории — последнее напоминание модели перед каждым новым битом. Работает по назначению, только если в порядке промптов стоит после «Ленты истории»."
          placeholder="Доп. инструкция перед каждым битом"
          value={draft.postHistoryInstruction}
          onChange={(v) => set("postHistoryInstruction", v)}
        />
        <PromptEditorField
          header="Промпт сжатия истории"
          hint="Инструкция для сжатия старых сообщений в краткий пересказ (compact). Плейсхолдер {{words}} — рекомендованное число слов из настроек истории. Работает, только если в порядке промптов включён «Краткое содержание». Пусто → встроенный дефолт."
          placeholder="Напр.: Сожми события в связный пересказ примерно на {{words}} слов; сохрани факты, имена и нерешённые линии."
          value={draft.compactionPrompt}
          onChange={(v) => set("compactionPrompt", v)}
        />
      </SettingsCard>

      <TranslationCard draft={draft} set={set} />
      <AssemblyCard draft={draft} set={set} />

      <Stack gap="sm">
        <Button fullWidth disabled={!valid && !submitting} loading={submitting} onClick={submit}>
          {initial ? "Сохранить" : "Создать шаблон"}
        </Button>
        {onDelete && (
          <DeleteButton onClick={onDelete} disabled={submitting}>
            Удалить шаблон
          </DeleteButton>
        )}
      </Stack>
    </Stack>
  );
}
