import { Input, SegmentedControl, Select } from "@mantine/core";
import { PromptEditorField } from "../../../shared/components/PromptEditorField";
import { SettingsCard } from "../../../shared/components/SettingsCard";
import { LANG_OPTIONS } from "../../../shared/constants/lang-options";
import type { useTranslateSettings } from "../hooks/useTranslateSettings";
import {
  PROMPT_TRANSLATE_REASONING_LABELS,
  PROMPT_TRANSLATE_REASONING_LEVELS,
  type PromptTranslateReasoningEffort,
  type TranslateSettings,
} from "../types/translateSettings";

const ENGINE_OPTIONS = [
  { value: "google", label: "Google" },
  { value: "ai", label: "ИИ" },
] as const satisfies { value: TranslateSettings["engine"]; label: string }[];

const LANG_DATA = LANG_OPTIONS.map(({ value, label }) => ({ value, label }));

const REASONING_DATA = PROMPT_TRANSLATE_REASONING_LEVELS.map((level) => ({
  value: level,
  label: PROMPT_TRANSLATE_REASONING_LABELS[level],
}));

type TranslateSettingsSectionProps = Omit<ReturnType<typeof useTranslateSettings>, "loading" | "saving">;

/**
 * Карточка «Перевод в редакторе» — дефолты режима перевода в PromptEditorOverlay (движок, целевой язык,
 * свой ИИ-промпт, рассуждение). Каждое поле сохраняется сразу при изменении. Свой промпт —
 * PromptEditorField: тап открывает полноэкранный редактор, пустое поле = дефолтный промпт.
 */
export function TranslateSettingsSection({
  settings,
  setEngine,
  setTargetLang,
  setPromptTemplate,
  setReasoningEffort,
}: TranslateSettingsSectionProps) {
  return (
    <SettingsCard
      title="Перевод в редакторе"
      description="Настройки по умолчанию для режима перевода в полноэкранном редакторе промптов."
    >
      <Input.Wrapper label="Движок" description="Чем переводить по умолчанию">
        <SegmentedControl
          fullWidth
          mt={6}
          data={ENGINE_OPTIONS}
          value={settings.engine}
          onChange={(value) => setEngine(value as TranslateSettings["engine"])}
          aria-label="Движок перевода по умолчанию"
        />
      </Input.Wrapper>
      <Select
        label="Целевой язык"
        description="Язык, на который переводим"
        data={LANG_DATA}
        value={settings.targetLang}
        onChange={(value) => value && setTargetLang(value)}
        allowDeselect={false}
      />
      <Select
        label="Рассуждение для перевода"
        description="Уровень «мышления» модели при ИИ-переводе, не зависит от настроек ответа ИИ"
        data={REASONING_DATA}
        value={settings.reasoningEffort}
        onChange={(value) => value && setReasoningEffort(value as PromptTranslateReasoningEffort)}
        allowDeselect={false}
      />
      <PromptEditorField
        header="Свой промпт ИИ-перевода"
        hint="Плейсхолдер {{target_lang}} подставляется английским названием языка. Пусто — используется дефолтный промпт."
        placeholder="You are a translation engine. Translate into {{target_lang}}…"
        value={settings.promptTemplate ?? ""}
        onChange={setPromptTemplate}
        previewLines={3}
      />
    </SettingsCard>
  );
}
