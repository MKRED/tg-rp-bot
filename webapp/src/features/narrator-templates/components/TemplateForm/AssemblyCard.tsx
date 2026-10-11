import { Switch, TextInput } from "@mantine/core";
import { PromptOrderEditor } from "../../../../shared/components/PromptOrderEditor";
import { SettingsCard } from "../../../../shared/components/SettingsCard";
import {
  NARRATOR_PROMPT_COMPONENT_LABELS,
  NARRATOR_PROMPT_COMPONENT_SOURCES,
  type NarratorTemplateInput,
} from "../../types/template";
import type { SetDraftField } from "./draft";

interface AssemblyCardProps {
  draft: NarratorTemplateInput;
  set: SetDraftField;
}

/** Карточка сборки запроса: порядок промптов, объединение системных и служебные маркеры ходов. */
export function AssemblyCard({ draft, set }: AssemblyCardProps) {
  return (
    <SettingsCard title="Сборка запроса" description="В каком порядке части попадают в запрос; выключенные не отправляются.">
      <PromptOrderEditor
        order={draft.promptOrder}
        onChange={(v) => set("promptOrder", v)}
        labels={NARRATOR_PROMPT_COMPONENT_LABELS}
        sources={NARRATOR_PROMPT_COMPONENT_SOURCES}
      />
      <Switch
        label="Объединять в один системный промпт"
        description="Все компоненты выше «Ленты истории» уйдут одним system-сообщением — каждый блок в теге со своим названием (<system>, <lorebook>, …)."
        checked={draft.mergeSystemPrompts}
        onChange={(e) => set("mergeSystemPrompts", e.currentTarget.checked)}
      />
      <TextInput
        label="Маркер «Продолжай»"
        description="Им заменяются отыгранные ходы пользователя (директивы, «Дальше») в истории — их последствие уже в тексте следующего бита. Им же сохраняется ход «Дальше» без директивы."
        withAsterisk
        value={draft.continueMarker}
        onChange={(e) => set("continueMarker", e.currentTarget.value)}
      />
      <TextInput
        label="Маркер «Начать»"
        description="Синтетическая первая реплика перед первым битом — без неё запрос начинался бы с ответа рассказчика, что отвергают некоторые провайдеры."
        withAsterisk
        value={draft.leadingUserMarker}
        onChange={(e) => set("leadingUserMarker", e.currentTarget.value)}
      />
    </SettingsCard>
  );
}
