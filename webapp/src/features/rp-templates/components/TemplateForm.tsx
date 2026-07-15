import { Button, Cell, Input, Switch } from "@telegram-apps/telegram-ui";
import { useState } from "react";
import { DeleteButton } from "../../../shared/components/DeleteButton";
import { PromptField } from "../../../shared/components/PromptField";
import { PromptOrderEditor } from "../../../shared/components/PromptOrderEditor";
import { SectionActions } from "../../../shared/components/SectionActions";
import { SectionWithFooter } from "../../../shared/components/SectionWithFooter";
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
    <SectionWithFooter
      className="section-blend-inputs"
      header="RP-шаблон"
      footer="Сэмплинг (температура и пр.) задаётся не здесь, а в пресете генерации («Настройки ответа ИИ»)."
    >
      <Input
        header="Название"
        placeholder="Напр. «Стандартный ролевой промпт»"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <PromptField
        label="Основной системный промпт"
        hint="Базовые инструкции модели: задаёт роль, стиль и правила ответа."
        value={systemPrompt}
        rows={6}
        onChange={setSystemPrompt}
      />
      <PromptField
        label="Вспомогательный системный промпт"
        hint="Дополнительные указания поверх основного — например, формат или ограничения."
        value={auxiliarySystemPrompt}
        onChange={setAuxiliarySystemPrompt}
      />
      <PromptField
        label="Инструкция после истории"
        hint="Текст, вставляемый после истории чата — последнее напоминание модели перед ответом."
        value={postHistoryInstruction}
        onChange={setPostHistoryInstruction}
      />
      <PromptField
        label="Промпт для генерации ответа от лица пользователя"
        hint="Шаблон системной инструкции. Плейсхолдеры: {{char}}, {{user}}, {{char_prompt}}, {{user_prompt}}, {{system_prompt}}, {{aux_prompt}}. История чата добавляется отдельным сообщением. Пусто → используется шаблон по умолчанию."
        value={userPersonaPrompt}
        rows={6}
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
      <PromptField
        label="Промпт для перевода (ИИ-режим)"
        hint="Системная инструкция для перевода черновика сообщения через нейросеть. Плейсхолдер {{target_lang}} — полное английское название выбранного языка. Пусто → используется шаблон по умолчанию."
        value={translationSystemPrompt}
        rows={6}
        onChange={setTranslationSystemPrompt}
      />
      {/* Гуттер 22px — как у полей tgui внутри карточки (выравнивание заголовка с рядами ниже). */}
      <div style={{ padding: "12px 22px 0", fontWeight: 600 }}>Порядок промптов</div>
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
    </SectionWithFooter>
  );
}
