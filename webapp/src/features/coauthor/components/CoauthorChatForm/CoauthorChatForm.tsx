import { Button, Switch, TextInput } from "@mantine/core";
import { PickerField } from "../../../../shared/components/PickerField";
import { PromptEditorField } from "../../../../shared/components/PromptEditorField";
import { SettingsCard } from "../../../../shared/components/SettingsCard";
import {
  DEFAULT_COAUTHOR_SYSTEM_PROMPT,
  type CoauthorCardOption,
  type CoauthorChatInput,
  type CoauthorPresetOption,
} from "../../types/coauthor";
import { CardsChecklist } from "./CardsChecklist";

interface CoauthorChatFormProps {
  value: CoauthorChatInput;
  onChange: (patch: Partial<CoauthorChatInput>) => void;
  cards: CoauthorCardOption[];
  cardsLoading: boolean;
  presets: CoauthorPresetOption[];
  presetsLoading: boolean;
  /** Подпись под названием: при создании оно собирается из имён карточек, если его не трогать. */
  namePlaceholder?: string;
}

/**
 * Настройки чата соавтора — одна форма для создания и для экрана настроек.
 *
 * Системный промпт: в редакторе всегда текст, который реально уйдёт модели, — стандартный, пока его не
 * меняли. Хранится пустая строка, пока текст совпадает со стандартным: так улучшения стандарта доходят
 * до чата сами. Протокол инструментов сервер дописывает отдельно, его здесь нет.
 */
export function CoauthorChatForm({ value, onChange, cards, cardsLoading, presets, presetsLoading, namePlaceholder }: CoauthorChatFormProps) {
  const customized = value.systemPrompt.trim() !== "";

  return (
    <>
      <SettingsCard title="Чат">
        <TextInput
          label="Название"
          placeholder={namePlaceholder ?? "Например: Сёстры Восс"}
          value={value.name}
          onChange={(e) => onChange({ name: e.currentTarget.value })}
        />
        <CardsChecklist options={cards} loading={cardsLoading} value={value.cardIds} onChange={(cardIds) => onChange({ cardIds })} />
      </SettingsCard>

      <SettingsCard title="ИИ" description="Каждую правку ИИ вы принимаете или отклоняете сами — карточки без вас не меняются.">
        <PickerField
          label="Пресет ИИ"
          description="Модель и мышление. Ответ соавтора — несколько вызовов модели, мышление стоит включить"
          placeholder="Выберите пресет"
          options={presets.map((p) => ({ id: p.id, title: p.name, description: p.summary }))}
          value={value.presetId}
          loading={presetsLoading}
          emptyText="Пресетов пока нет — создайте их в «Настройках ответа ИИ»."
          onChange={(presetId) => onChange({ presetId })}
        />
        <PromptEditorField
          header="Системный промпт"
          hint="Правила поведения соавтора: тон, язык, что можно менять. Карточки и инструменты подставляются автоматически — их писать не нужно."
          value={value.systemPrompt || DEFAULT_COAUTHOR_SYSTEM_PROMPT}
          previewLines={3}
          onChange={(text) => onChange({ systemPrompt: text.trim() === DEFAULT_COAUTHOR_SYSTEM_PROMPT ? "" : text })}
          // «Сбросить» видна, только пока промпт отличается от стандартного, — она же и признак правки.
          headerAction={
            customized ? (
              <Button variant="subtle" size="compact-xs" onClick={() => onChange({ systemPrompt: "" })}>
                Сбросить
              </Button>
            ) : undefined
          }
        />
        <Switch
          label="Уточняющие вопросы"
          description="ИИ сможет спросить, если запрос неоднозначный или выбор за вами"
          checked={value.useAskUser}
          onChange={(e) => onChange({ useAskUser: e.currentTarget.checked })}
        />
        <Switch
          label="Веб-поиск"
          description="Для персонажей из канона: ИИ проверит факты в интернете"
          checked={value.useWebSearch}
          onChange={(e) => onChange({ useWebSearch: e.currentTarget.checked })}
        />
      </SettingsCard>
    </>
  );
}
