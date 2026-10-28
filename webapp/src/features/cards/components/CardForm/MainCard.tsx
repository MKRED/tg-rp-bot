import { Alert, Switch, TextInput } from "@mantine/core";
import { TriangleAlert } from "lucide-react";
import { PickerField } from "../../../../shared/components/PickerField";
import { PromptEditorField } from "../../../../shared/components/PromptEditorField";
import { SettingsCard } from "../../../../shared/components/SettingsCard";
import { DEFAULT_CARD_PROMPT, DEFAULT_CARD_SYSTEM_PROMPT, type CardPresetOption } from "../../types/card";
import { ReferenceImagesField } from "./ReferenceImagesField";

interface MainCardProps {
  name: string;
  systemPrompt: string;
  prompt: string;
  presetId: number | null;
  useWebSearch: boolean;
  useAskUser: boolean;
  /** Режим кнопки «с вопросами»: вопросы первым ходом (true) или после остальных инструментов. */
  askUserFirst: boolean;
  referenceImages: string[];
  /** Референсы есть, а модель выбранного пресета их не видит — предупреждение под пикером пресета. */
  imagesUnsupported: boolean;
  presets: CardPresetOption[];
  presetsLoading: boolean;
  /** Есть ли сохранённый ключ Tavily — без него веб-поиск не включить. */
  webSearchAvailable: boolean;
  /** Статус ключа ещё грузится — не пугаем «добавьте ключ» того, у кого он есть. */
  webSearchStatusLoading: boolean;
  onName: (value: string) => void;
  onSystemPrompt: (value: string) => void;
  onPrompt: (value: string) => void;
  onPresetId: (value: number) => void;
  onUseWebSearch: (value: boolean) => void;
  onUseAskUser: (value: boolean) => void;
  onAskUserFirst: (value: boolean) => void;
  onReferenceImages: (images: string[]) => void;
}

/** Карточка «Основное»: название, промпты генерации, референсы, пресет ИИ и инструменты модели. */
export function MainCard(props: MainCardProps) {
  const webSearchHint = props.webSearchStatusLoading
    ? "Проверяем ключ Tavily…"
    : props.webSearchAvailable
      ? "Модель сможет искать в интернете при генерации блоков"
      : "Добавьте ключ Tavily в настройках, чтобы включить";

  return (
    <SettingsCard title="Основное">
      <TextInput
        label="Название"
        placeholder="Название карточки"
        withAsterisk
        value={props.name}
        onChange={(e) => props.onName(e.currentTarget.value)}
      />
      <PromptEditorField
        header="Системный промпт"
        hint="Инструкции ИИ о самом процессе генерации: что блоки создаются строго по одному, что <example> ниже — только образец формата, а не готовый ответ. Не зависит от конкретного персонажа."
        placeholder={DEFAULT_CARD_SYSTEM_PROMPT}
        value={props.systemPrompt}
        previewLines={6}
        onChange={props.onSystemPrompt}
      />
      <PromptEditorField
        header="Основной промпт"
        hint="Общая инструкция для ИИ. Можно вставить {{example}} — на его место встанет структура категорий; если не вставить, она допишется в конец."
        placeholder={DEFAULT_CARD_PROMPT}
        value={props.prompt}
        previewLines={6}
        onChange={props.onPrompt}
      />
      <ReferenceImagesField images={props.referenceImages} onChange={props.onReferenceImages} />
      <PickerField
        label="Пресет ИИ"
        description="Нужен для генерации блоков"
        placeholder="Выберите пресет"
        options={props.presets.map((p) => ({ id: p.id, title: p.name, description: p.summary }))}
        value={props.presetId}
        loading={props.presetsLoading}
        emptyText="Пресетов пока нет — создайте их в «Настройках ответа ИИ»."
        onChange={props.onPresetId}
      />
      {props.imagesUnsupported && (
        <Alert color="orange" icon={<TriangleAlert size={18} />}>
          Модель этого пресета не видит картинки. Выберите пресет с deepseek-flash или уберите референсы.
        </Alert>
      )}
      <Switch
        label="Веб-поиск"
        description={webSearchHint}
        checked={props.useWebSearch}
        disabled={props.webSearchStatusLoading || !props.webSearchAvailable}
        onChange={(e) => props.onUseWebSearch(e.currentTarget.checked)}
      />
      <Switch
        label="Уточняющие вопросы"
        description="Модель сможет задать вопрос перед генерацией блока, если ей не хватает информации"
        checked={props.useAskUser}
        onChange={(e) => props.onUseAskUser(e.currentTarget.checked)}
      />
      {/* Режим кнопок «с вопросами» — только при включённых уточнениях (без них кнопок нет). */}
      {props.useAskUser && (
        <Switch
          label="«С вопросами» — сразу"
          description={
            props.askUserFirst
              ? "Кнопка «С вопросами» требует вопросы первым же ходом — до веб-поиска и других инструментов"
              : "Кнопка «С вопросами» сначала даёт модели вызвать другие инструменты (веб-поиск) и требует вопросы в конце; черновой ответ модели при этом отбрасывается"
          }
          checked={props.askUserFirst}
          onChange={(e) => props.onAskUserFirst(e.currentTarget.checked)}
        />
      )}
    </SettingsCard>
  );
}
