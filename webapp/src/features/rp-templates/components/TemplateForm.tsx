import { Button, Cell, Input, Section, Switch, Text } from "@telegram-apps/telegram-ui";
import { useState } from "react";
import { DeleteButton } from "../../../shared/components/DeleteButton";
import { PromptEditorField } from "../../../shared/components/PromptEditorField";
import { PromptOrderEditor } from "../../../shared/components/PromptOrderEditor";
import { SectionActions } from "../../../shared/components/SectionActions";
import { DEFAULT_IMPERSONATE_TEMPLATE } from "../lib/impersonateTemplate";
import {
  DEFAULT_PROMPT_ORDER,
  PROMPT_COMPONENT_LABELS,
  PROMPT_COMPONENT_SOURCES,
  UNIMPLEMENTED_COMPONENTS,
  type PromptOrderItem,
  type RpTemplate,
  type RpTemplateInput,
} from "../types/template";

interface TemplateFormProps {
  initial?: RpTemplate;
  submitting: boolean;
  onSubmit: (input: RpTemplateInput) => void;
  onDelete?: () => void;
}

/** Форма RP-шаблона: имя + промпты + служебные (impersonate/перевод) + порядок промптов. */
export function TemplateForm({ initial, submitting, onSubmit, onDelete }: TemplateFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [systemPrompt, setSystemPrompt] = useState(initial?.systemPrompt ?? "");
  const [auxiliarySystemPrompt, setAuxiliarySystemPrompt] = useState(
    initial?.auxiliarySystemPrompt ?? "",
  );
  const [postHistoryInstruction, setPostHistoryInstruction] = useState(
    initial?.postHistoryInstruction ?? "",
  );
  const [userPersonaPrompt, setUserPersonaPrompt] = useState(initial?.userPersonaPrompt ?? "");
  const [userPersonaStreaming, setUserPersonaStreaming] = useState(
    initial?.userPersonaStreaming ?? true,
  );
  const [translationSystemPrompt, setTranslationSystemPrompt] = useState(
    initial?.translationSystemPrompt ?? "",
  );
  const [promptOrder, setPromptOrder] = useState<PromptOrderItem[]>(
    initial?.promptOrder ?? DEFAULT_PROMPT_ORDER,
  );

  const valid = name.trim().length > 0;

  return (
    <Section className="section-blend-inputs" header="RP-шаблон">
      <Input
        header="Название"
        placeholder="Напр. «Стандартный ролевой промпт»"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <PromptEditorField
        header="Основной системный промпт"
        hint="Базовые инструкции модели: задаёт роль, стиль и правила ответа."
        placeholder="Обязательный промпт — нажмите, чтобы заполнить"
        value={systemPrompt}
        previewLines={6}
        onChange={setSystemPrompt}
      />
      <PromptEditorField
        header="Вспомогательный системный промпт"
        hint="Дополнительные указания поверх основного — например, формат или ограничения."
        value={auxiliarySystemPrompt}
        onChange={setAuxiliarySystemPrompt}
      />
      <PromptEditorField
        header="Инструкция после истории"
        hint="Текст, вставляемый после истории чата — последнее напоминание модели перед ответом."
        value={postHistoryInstruction}
        onChange={setPostHistoryInstruction}
      />
      <PromptEditorField
        header="Промпт для генерации ответа от лица пользователя"
        hint="Шаблон системной инструкции. Плейсхолдеры: {{char}}, {{user}}, {{char_prompt}}, {{user_prompt}}, {{system_prompt}}, {{aux_prompt}}. История чата добавляется отдельным сообщением. Пусто → используется шаблон по умолчанию."
        value={userPersonaPrompt}
        placeholder={DEFAULT_IMPERSONATE_TEMPLATE}
        onChange={setUserPersonaPrompt}
      />
      <Cell
        after={
          <Switch
            checked={userPersonaStreaming}
            onChange={(e) => setUserPersonaStreaming(e.target.checked)}
          />
        }
        subtitle="Показывать текст по мере генерации варианта"
      >
        Стримить ответ от лица пользователя
      </Cell>
      <PromptEditorField
        header="Промпт для перевода (ИИ-режим)"
        hint="Системная инструкция для перевода черновика сообщения через нейросеть. Плейсхолдер {{target_lang}} — полное английское название выбранного языка. Пусто → используется шаблон по умолчанию."
        value={translationSystemPrompt}
        onChange={setTranslationSystemPrompt}
      />
      {/* Гуттер 22px — как у полей tgui внутри карточки (выравнивание заголовка с рядами ниже). */}
      <Text weight="2" Component="div" style={{ padding: "12px 22px 0" }}>Порядок промптов</Text>
      <PromptOrderEditor
        order={promptOrder}
        onChange={setPromptOrder}
        labels={PROMPT_COMPONENT_LABELS}
        sources={PROMPT_COMPONENT_SOURCES}
        unimplemented={UNIMPLEMENTED_COMPONENTS}
      />
      <SectionActions>
        <Button
          size="l"
          stretched
          disabled={!valid || submitting}
          onClick={() =>
            onSubmit({
              name: name.trim(),
              systemPrompt,
              auxiliarySystemPrompt,
              postHistoryInstruction,
              userPersonaPrompt,
              userPersonaStreaming,
              translationSystemPrompt,
              promptOrder,
            })
          }
        >
          {initial ? "Сохранить" : "Создать шаблон"}
        </Button>
        {onDelete && (
          <DeleteButton onClick={onDelete} disabled={submitting}>
            Удалить шаблон
          </DeleteButton>
        )}
      </SectionActions>
    </Section>
  );
}
