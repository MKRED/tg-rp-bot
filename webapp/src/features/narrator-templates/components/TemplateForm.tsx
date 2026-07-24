import { Button, Cell, Input, Section, Switch } from "@telegram-apps/telegram-ui";
import { useState } from "react";
import { DeleteButton } from "../../../shared/components/DeleteButton";
import { HintedInput } from "../../../shared/components/HintedInput";
import { PromptEditorField } from "../../../shared/components/PromptEditorField";
import { PromptOrderEditor } from "../../../shared/components/PromptOrderEditor";
import { SectionActions } from "../../../shared/components/SectionActions";
import {
  DEFAULT_CONTINUE_MARKER,
  DEFAULT_LEADING_USER_MARKER,
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
  const [compactionPrompt, setCompactionPrompt] = useState(initial?.compactionPrompt ?? "");
  const [continueMarker, setContinueMarker] = useState(
    initial?.continueMarker ?? DEFAULT_CONTINUE_MARKER,
  );
  const [leadingUserMarker, setLeadingUserMarker] = useState(
    initial?.leadingUserMarker ?? DEFAULT_LEADING_USER_MARKER,
  );
  const [promptOrder, setPromptOrder] = useState<StoryPromptOrderItem[]>(
    initial?.promptOrder ?? DEFAULT_NARRATOR_PROMPT_ORDER,
  );
  const [mergeSystemPrompts, setMergeSystemPrompts] = useState(initial?.mergeSystemPrompts ?? false);

  const valid =
    name.trim().length > 0 && continueMarker.trim().length > 0 && leadingUserMarker.trim().length > 0;

  return (
    <Section className="section-blend-inputs" header="Narrator-шаблон">
      <Input
        header="Название"
        placeholder="Напр. «Кинематографичный рассказчик»"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <PromptEditorField
        header="Инструкция нарратора"
        hint="Системный промпт для режима «Режиссёр истории»: задаёт роль рассказчика, стиль и правила ведения сцены. Пусто → применится встроенный дефолт."
        placeholder={SYSTEM_PLACEHOLDER}
        previewLines={6}
        value={systemPrompt}
        onChange={setSystemPrompt}
      />
      <PromptEditorField
        header="Вспомогательный системный промпт"
        hint="Дополнительные указания поверх основного — например, формат или ограничения."
        value={auxiliarySystemPrompt}
        onChange={setAuxiliarySystemPrompt}
      />
      <PromptEditorField
        header="После истории (необязательно)"
        hint="Доп. инструкция, вставляемая после истории — последнее напоминание модели перед каждым новым битом. Работает по назначению, только если в порядке промптов стоит после «Ленты истории»."
        placeholder="Доп. инструкция перед каждым битом"
        value={postHistory}
        onChange={setPostHistory}
      />
      <PromptEditorField
        header="Промпт для перевода (ИИ-режим)"
        hint="Системная инструкция для ИИ-режима перевода черновика директивы (штора перевода в истории). Плейсхолдер {{target_lang}} — полное английское название выбранного языка. Пусто → перевод без спец-инструкций."
        placeholder="Напр.: Переводи бережно, сохраняя стиль и формат; не добавляй пояснений."
        value={translationSystemPrompt}
        onChange={setTranslationSystemPrompt}
      />
      <PromptEditorField
        header="Промпт сжатия истории"
        hint="Инструкция для сжатия старых сообщений в краткий пересказ (compact). Плейсхолдер {{words}} — рекомендованное число слов из настроек истории. Работает, только если в порядке промптов включён «Краткое содержание». Пусто → встроенный дефолт."
        placeholder="Напр.: Сожми события в связный пересказ примерно на {{words}} слов; сохрани факты, имена и нерешённые линии."
        value={compactionPrompt}
        onChange={setCompactionPrompt}
      />
      <HintedInput
        header="Маркер «Продолжай» (обязательно)"
        hint="Текст, которым нейтрализуются отыгранные user-ходы (директивы/«Дальше») в истории — их последствие уже живёт в тексте следующего бита, повторно инструктировать не нужно. Этим же текстом сохраняется живой ход при клике «Дальше» без директивы."
        value={continueMarker}
        onChange={(e) => setContinueMarker(e.target.value)}
      />
      <HintedInput
        header="Маркер «Начать» (обязательно)"
        hint="Синтетическая открывающая реплика перед первым битом истории — без неё запрос к модели начинался бы с ответа рассказчика, что отвергают некоторые провайдеры."
        value={leadingUserMarker}
        onChange={(e) => setLeadingUserMarker(e.target.value)}
      />
      {/* Гуттер 22px — как у полей tgui внутри карточки (выравнивание заголовка с рядами ниже). */}
      <div style={{ padding: "12px 22px 0", fontWeight: 600 }}>Порядок промптов</div>
      <PromptOrderEditor
        order={promptOrder}
        onChange={setPromptOrder}
        labels={NARRATOR_PROMPT_COMPONENT_LABELS}
        sources={NARRATOR_PROMPT_COMPONENT_SOURCES}
      />
      <Cell
        after={
          <Switch
            checked={mergeSystemPrompts}
            onChange={(e) => setMergeSystemPrompts(e.target.checked)}
          />
        }
        subtitle="Все компоненты, стоящие в порядке выше «Ленты истории», уйдут одним system-сообщением — каждый блок обёрнут в тег со своим названием (<system>, <lorebook>, …)"
      >
        Объединять в один системный промпт
      </Cell>
      <SectionActions>
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
              compactionPrompt: compactionPrompt,
              continueMarker: continueMarker.trim(),
              leadingUserMarker: leadingUserMarker.trim(),
              promptOrder: promptOrder,
              mergeSystemPrompts: mergeSystemPrompts,
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
