import { Select, Switch } from "@mantine/core";
import { PromptEditorField } from "../../../../shared/components/PromptEditorField";
import { SettingsCard } from "../../../../shared/components/SettingsCard";
import {
  TRANSLATION_REASONING_LABELS,
  TRANSLATION_REASONING_LEVELS,
  type NarratorTemplateInput,
  type TranslationReasoningLevel,
} from "../../types/template";
import type { SetDraftField } from "./draft";

const REASONING_OPTIONS = TRANSLATION_REASONING_LEVELS.map((level) => ({
  value: level,
  label: TRANSLATION_REASONING_LABELS[level],
}));

interface TranslationCardProps {
  draft: NarratorTemplateInput;
  set: SetDraftField;
}

/** Карточка ИИ-перевода директив и битов: промпт, уровень рассуждения, перевод по абзацам. */
export function TranslationCard({ draft, set }: TranslationCardProps) {
  return (
    <SettingsCard title="Перевод" description="ИИ-режим перевода директив и битов в истории.">
      <PromptEditorField
        header="Промпт для перевода"
        hint="Системная инструкция для ИИ-режима перевода черновика директивы (штора перевода в истории). Плейсхолдер {{target_lang}} — полное английское название выбранного языка. Пусто → перевод без спец-инструкций."
        placeholder="Напр.: Переводи бережно, сохраняя стиль и формат; не добавляй пояснений."
        value={draft.translationSystemPrompt}
        onChange={(v) => set("translationSystemPrompt", v)}
      />
      <Select
        label="Рассуждение для перевода"
        description="Уровень «мышления» модели при ИИ-переводе, не зависит от настроек ответа ИИ."
        data={REASONING_OPTIONS}
        value={draft.translationReasoningEffort}
        // allowDeselect={false}: значение обязательно, пустой выбор сервер не примет.
        allowDeselect={false}
        onChange={(v) => v && set("translationReasoningEffort", v as TranslationReasoningLevel)}
      />
      <Switch
        label="Переводить по абзацам"
        description="Текст делится на абзацы, каждый переводится отдельным запросом параллельно — быстрее на большом тексте с включённым мышлением; само мышление не отключается."
        checked={draft.translatePerParagraph}
        onChange={(e) => set("translatePerParagraph", e.currentTarget.checked)}
      />
    </SettingsCard>
  );
}
