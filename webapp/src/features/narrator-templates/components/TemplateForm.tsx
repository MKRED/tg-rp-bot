import { Button, Input, Section } from "@telegram-apps/telegram-ui";
import { useState } from "react";
import { PromptField } from "../../../shared/components/PromptField";
import { PromptOrderEditor } from "../../../shared/components/PromptOrderEditor";
import {
  DEFAULT_NARRATOR_PROMPT_ORDER,
  NARRATOR_PROMPT_COMPONENT_LABELS,
  NARRATOR_PROMPT_COMPONENT_SOURCES,
  type NarratorTemplate,
  type NarratorTemplateInput,
  type StoryPromptOrderItem,
} from "../types/template";

/** Подсказка-плейсхолдер: что писать в нарратор-инструкции (дефолт применяется, если оставить пусто). */
const SYSTEM_PLACEHOLDER =
  "Напр.: Ты рассказчик. Веди сцену, озвучивай всех персонажей, не пиши за пользователя. Заканчивай каждый бит на крючке. (Пусто → применится встроенный дефолт.)";

interface TemplateFormProps {
  initial?: NarratorTemplate;
  submitting: boolean;
  onSubmit: (input: NarratorTemplateInput) => void;
  onDelete?: () => void;
}

/** Форма narrator-шаблона: имя + инструкция + вспомогательный промпт + post-history + порядок промптов. */
export function TemplateForm({ initial, submitting, onSubmit, onDelete }: TemplateFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [systemPrompt, setSystemPrompt] = useState(initial?.systemPrompt ?? "");
  const [auxiliarySystemPrompt, setAuxiliarySystemPrompt] = useState(
    initial?.auxiliarySystemPrompt ?? "",
  );
  const [postHistory, setPostHistory] = useState(initial?.postHistoryInstruction ?? "");
  const [translationSystemPrompt, setTranslationSystemPrompt] = useState(
    initial?.translationSystemPrompt ?? "",
  );
  const [promptOrder, setPromptOrder] = useState<StoryPromptOrderItem[]>(
    initial?.promptOrder ?? DEFAULT_NARRATOR_PROMPT_ORDER,
  );

  const valid = name.trim().length > 0;

  return (
    <Section className="section-blend-inputs" header="Narrator-шаблон">
      <Input
        header="Название"
        placeholder="Напр. «Кинематографичный рассказчик»"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <PromptField
        label="Инструкция нарратора"
        hint="Системный промпт для режима «Режиссёр истории»: задаёт роль рассказчика, стиль и правила ведения сцены. Пусто → применится встроенный дефолт."
        placeholder={SYSTEM_PLACEHOLDER}
        rows={6}
        value={systemPrompt}
        onChange={setSystemPrompt}
      />
      <PromptField
        label="Вспомогательный системный промпт"
        hint="Дополнительные указания поверх основного — например, формат или ограничения."
        value={auxiliarySystemPrompt}
        onChange={setAuxiliarySystemPrompt}
      />
      <PromptField
        label="После истории (необязательно)"
        hint="Доп. инструкция, вставляемая после истории — последнее напоминание модели перед каждым новым битом. Работает по назначению, только если в порядке промптов стоит после «Ленты истории»."
        placeholder="Доп. инструкция перед каждым битом"
        rows={6}
        value={postHistory}
        onChange={setPostHistory}
      />
      <PromptField
        label="Системный промпт перевода"
        hint="Указания для ИИ-режима перевода черновика директивы (штора перевода в истории). Пусто → перевод без спец-инструкций."
        placeholder="Напр.: Переводи бережно, сохраняя стиль и формат; не добавляй пояснений."
        rows={4}
        value={translationSystemPrompt}
        onChange={setTranslationSystemPrompt}
      />
      {/* Гуттер 22px — как у полей tgui внутри карточки (выравнивание заголовка с рядами ниже). */}
      <div style={{ padding: "12px 22px 0", fontWeight: 600 }}>Порядок промптов</div>
      <PromptOrderEditor
        order={promptOrder}
        onChange={setPromptOrder}
        labels={NARRATOR_PROMPT_COMPONENT_LABELS}
        sources={NARRATOR_PROMPT_COMPONENT_SOURCES}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24, padding: "0 22px" }}>
        <Button
          size="l"
          stretched
          disabled={!valid || submitting}
          onClick={() =>
            onSubmit({
              name: name.trim(),
              systemPrompt: systemPrompt,
              auxiliarySystemPrompt: auxiliarySystemPrompt,
              postHistoryInstruction: postHistory,
              translationSystemPrompt: translationSystemPrompt,
              promptOrder: promptOrder,
            })
          }
        >
          {initial ? "Сохранить" : "Создать шаблон"}
        </Button>
        {onDelete && (
          <Button size="l" mode="outline" stretched onClick={onDelete} disabled={submitting}>
            Удалить шаблон
          </Button>
        )}
      </div>
      {/* Бывший проп footer Section — рендерим внутри карточки, чтобы он не выбивался по фону. */}
      <p className="section-note">
        Сэмплинг (температура и пр.) задаётся не здесь, а в пресете генерации.
      </p>
    </Section>
  );
}
