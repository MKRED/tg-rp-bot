import { Button, Stack, Switch, Text, TextInput } from "@mantine/core";
import { useState } from "react";
import { DeleteButton } from "../../../../shared/components/DeleteButton";
import { PromptEditorField } from "../../../../shared/components/PromptEditorField";
import { SettingsCard } from "../../../../shared/components/SettingsCard";
import { STANDARD_CARD_TEMPLATE, type CardField, type CardTemplateInput } from "../../types/cardTemplate";
import { FieldsEditor } from "../FieldsEditor";

interface CardTemplateFormProps {
  /** Начальные значения: сохранённый шаблон или встроенный «Стандартный» для нового. */
  initial?: CardTemplateInput;
  submitting: boolean;
  onSubmit: (input: CardTemplateInput) => void;
  onDelete?: () => void;
}

const newField = (): CardField => ({ id: `custom-${crypto.randomUUID()}`, title: "", description: "", enabled: true });

/**
 * Форма шаблона карточки: название, системный промпт, тумблеры инструментов и поля. Всё это при
 * выборе шаблона копируется в карточку — правка шаблона уже созданные карточки не меняет.
 */
export function CardTemplateForm({ initial = STANDARD_CARD_TEMPLATE, submitting, onSubmit, onDelete }: CardTemplateFormProps) {
  // Новый шаблон стартует со «Стандартного», но без его имени — название пользователь даёт сам.
  const [name, setName] = useState(initial === STANDARD_CARD_TEMPLATE ? "" : initial.name);
  const [systemPrompt, setSystemPrompt] = useState(initial.systemPrompt);
  const [fields, setFields] = useState(initial.fields);
  const [useWebSearch, setUseWebSearch] = useState(initial.useWebSearch);
  const [useAskUser, setUseAskUser] = useState(initial.useAskUser);
  const [askUserFirst, setAskUserFirst] = useState(initial.askUserFirst);

  // Пустой шаблон сервер не примет: карточка из него получила бы дефолтную структуру.
  const valid = name.trim().length > 0 && fields.length > 0;

  const submit = () =>
    onSubmit({ name: name.trim(), systemPrompt, fields, useWebSearch, useAskUser, askUserFirst });

  return (
    <Stack gap="lg">
      <SettingsCard title="Основное">
        <TextInput
          label="Название"
          placeholder="Напр. «NPC для фэнтези»"
          withAsterisk
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <PromptEditorField
          header="Системный промпт"
          hint="Инструкции ИИ о самом процессе генерации: блоки создаются строго по одному, <example> — только образец формата. Пусто → в карточке применится встроенный."
          placeholder={STANDARD_CARD_TEMPLATE.systemPrompt}
          value={systemPrompt}
          previewLines={3}
          onChange={setSystemPrompt}
        />
        <Switch
          label="Веб-поиск"
          description="Модель сможет искать в интернете при генерации блоков"
          checked={useWebSearch}
          onChange={(e) => setUseWebSearch(e.currentTarget.checked)}
        />
        <Switch
          label="Уточняющие вопросы"
          description="Модель сможет задать вопрос перед генерацией блока"
          checked={useAskUser}
          onChange={(e) => setUseAskUser(e.currentTarget.checked)}
        />
        {useAskUser && (
          <Switch
            label="«С вопросами» — сразу"
            description="Кнопка «С вопросами» требует вопросы первым же ходом, до веб-поиска"
            checked={askUserFirst}
            onChange={(e) => setAskUserFirst(e.currentTarget.checked)}
          />
        )}
      </SettingsCard>

      <FieldsEditor fields={fields} onChange={setFields} createField={newField} />

      <Stack gap="sm">
        <Button fullWidth disabled={!valid || submitting} loading={submitting} onClick={submit}>
          Сохранить
        </Button>
        <Text size="xs" c="dimmed" ta="center">
          Изменения не затрагивают уже созданные карточки
        </Text>
        {onDelete && (
          <DeleteButton disabled={submitting} onClick={onDelete}>
            Удалить шаблон
          </DeleteButton>
        )}
      </Stack>
    </Stack>
  );
}
