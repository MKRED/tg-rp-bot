import { Button, Stack, Switch, TextInput } from "@mantine/core";
import { useState } from "react";
import { DeleteButton } from "../../../shared/components/DeleteButton";
import { PromptEditorField } from "../../../shared/components/PromptEditorField";
import { PromptOrderEditor } from "../../../shared/components/PromptOrderEditor";
import { SettingsCard } from "../../../shared/components/SettingsCard";
import { DEFAULT_IMPERSONATE_TEMPLATE } from "../lib/impersonateTemplate";
import {
  DEFAULT_PROMPT_ORDER,
  PROMPT_COMPONENT_LABELS,
  PROMPT_COMPONENT_SOURCES,
  UNIMPLEMENTED_COMPONENTS,
  type RpTemplate,
  type RpTemplateInput,
} from "../types/template";

interface TemplateFormProps {
  initial?: RpTemplate;
  submitting: boolean;
  onSubmit: (input: RpTemplateInput) => void;
  onDelete?: () => void;
}

/** Значения формы: из сохранённого шаблона или пустые для нового. */
function toDraft(initial?: RpTemplate): RpTemplateInput {
  return {
    name: initial?.name ?? "",
    systemPrompt: initial?.systemPrompt ?? "",
    auxiliarySystemPrompt: initial?.auxiliarySystemPrompt ?? "",
    postHistoryInstruction: initial?.postHistoryInstruction ?? "",
    userPersonaPrompt: initial?.userPersonaPrompt ?? "",
    userPersonaStreaming: initial?.userPersonaStreaming ?? true,
    translationSystemPrompt: initial?.translationSystemPrompt ?? "",
    promptOrder: initial?.promptOrder ?? DEFAULT_PROMPT_ORDER,
  };
}

/** Форма RP-шаблона: название, промпты, ответ от лица пользователя, перевод и порядок промптов. */
export function TemplateForm({ initial, submitting, onSubmit, onDelete }: TemplateFormProps) {
  const [draft, setDraft] = useState(() => toDraft(initial));
  const set = <K extends keyof RpTemplateInput>(key: K, value: RpTemplateInput[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const valid = draft.name.trim().length > 0;

  return (
    <Stack gap="lg">
      <SettingsCard title="Основное">
        <TextInput
          label="Название"
          placeholder="Напр. «Стандартный ролевой промпт»"
          withAsterisk
          value={draft.name}
          onChange={(e) => set("name", e.currentTarget.value)}
        />
      </SettingsCard>

      <SettingsCard title="Промпты" description="Из чего собирается запрос к нейросети в RP-чате.">
        <PromptEditorField
          header="Основной системный промпт"
          hint="Базовые инструкции модели: задаёт роль, стиль и правила ответа."
          placeholder="Обязательный промпт — нажмите, чтобы заполнить"
          value={draft.systemPrompt}
          previewLines={6}
          onChange={(v) => set("systemPrompt", v)}
        />
        <PromptEditorField
          header="Вспомогательный системный промпт"
          hint="Дополнительные указания поверх основного — например, формат или ограничения."
          value={draft.auxiliarySystemPrompt}
          onChange={(v) => set("auxiliarySystemPrompt", v)}
        />
        <PromptEditorField
          header="Инструкция после истории"
          hint="Текст, вставляемый после истории чата — последнее напоминание модели перед ответом."
          value={draft.postHistoryInstruction}
          onChange={(v) => set("postHistoryInstruction", v)}
        />
      </SettingsCard>

      <SettingsCard title="Ответ от лица пользователя" description="Когда нейросеть предлагает реплику за вашу персону.">
        <PromptEditorField
          header="Промпт генерации"
          hint="Шаблон системной инструкции. Плейсхолдеры: {{char}}, {{user}}, {{char_prompt}}, {{user_prompt}}, {{system_prompt}}, {{aux_prompt}}. История чата добавляется отдельным сообщением. Пусто → используется шаблон по умолчанию."
          value={draft.userPersonaPrompt}
          placeholder={DEFAULT_IMPERSONATE_TEMPLATE}
          onChange={(v) => set("userPersonaPrompt", v)}
        />
        <Switch
          label="Стримить ответ"
          description="Показывать текст по мере генерации варианта"
          checked={draft.userPersonaStreaming}
          onChange={(e) => set("userPersonaStreaming", e.currentTarget.checked)}
        />
      </SettingsCard>

      <SettingsCard title="Перевод">
        <PromptEditorField
          header="Промпт для перевода (ИИ-режим)"
          hint="Системная инструкция для перевода черновика сообщения через нейросеть. Плейсхолдер {{target_lang}} — полное английское название выбранного языка. Пусто → используется шаблон по умолчанию."
          value={draft.translationSystemPrompt}
          onChange={(v) => set("translationSystemPrompt", v)}
        />
      </SettingsCard>

      <SettingsCard title="Порядок промптов" description="В каком порядке части попадают в запрос; выключенные не отправляются.">
        <PromptOrderEditor
          order={draft.promptOrder}
          onChange={(v) => set("promptOrder", v)}
          labels={PROMPT_COMPONENT_LABELS}
          sources={PROMPT_COMPONENT_SOURCES}
          unimplemented={UNIMPLEMENTED_COMPONENTS}
        />
      </SettingsCard>

      <Stack gap="sm">
        <Button
          fullWidth
          disabled={!valid && !submitting}
          loading={submitting}
          onClick={() => onSubmit({ ...draft, name: draft.name.trim() })}
        >
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
