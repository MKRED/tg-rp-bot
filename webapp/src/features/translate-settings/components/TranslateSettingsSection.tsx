import { Cell, Section } from "@telegram-apps/telegram-ui";
import { useState } from "react";
import { ExpandableSelect } from "../../../shared/components/ExpandableSelect";
import { PromptEditorField } from "../../../shared/components/PromptEditorField";
import { SegmentedToggle } from "../../../shared/components/SegmentedToggle";
import { LANG_OPTIONS } from "../../../shared/constants/lang-options";
import type { useTranslateSettings } from "../hooks/useTranslateSettings";
import type { TranslateSettings } from "../types/translateSettings";

const ENGINE_OPTIONS = [
  { value: "google", label: "Google" },
  { value: "ai", label: "ИИ" },
] as const satisfies { value: TranslateSettings["engine"]; label: string }[];

type TranslateSettingsSectionProps = Omit<ReturnType<typeof useTranslateSettings>, "loading" | "saving">;

/**
 * Секция настроек «Перевод в редакторе» — дефолты режима перевода в PromptEditorOverlay (движок,
 * целевой язык, свой ИИ-промпт). Свой промпт — PromptEditorField (как translationSystemPrompt у
 * RP-шаблонов): тап открывает полноэкранный PromptEditorOverlay, сохранение — на «Готово» внутри
 * него; пустое поле = дефолтный промпт (плейсхолдер это и объясняет), отдельная кнопка «Сбросить»
 * не нужна — очистка текста в оверлее и есть сброс.
 */
export function TranslateSettingsSection({
  settings,
  setEngine,
  setTargetLang,
  setPromptTemplate,
}: TranslateSettingsSectionProps) {
  const [langSelectOpen, setLangSelectOpen] = useState(false);

  return (
    <Section className="section-blend-inputs" header="Перевод в редакторе">
      <Cell
        subtitle="Движок по умолчанию в режиме перевода полноэкранного редактора"
        after={
          <SegmentedToggle
            options={ENGINE_OPTIONS}
            value={settings.engine}
            onChange={setEngine}
            ariaLabel="Движок перевода по умолчанию"
          />
        }
      >
        Движок
      </Cell>
      <ExpandableSelect
        title="Целевой язык"
        subtitle="Язык на который переводим"
        options={LANG_OPTIONS}
        value={settings.targetLang}
        onChange={(value) => {
          setTargetLang(value);
          setLangSelectOpen(false);
        }}
        open={langSelectOpen}
        onToggle={() => setLangSelectOpen((v) => !v)}
      />
      <PromptEditorField
        header="Свой промпт ИИ-перевода"
        hint="Плейсхолдер {{target_lang}} подставляется английским названием языка. Пусто — используется дефолтный промпт."
        placeholder="You are a translation engine. Translate into {{target_lang}}…"
        value={settings.promptTemplate ?? ""}
        onChange={setPromptTemplate}
        previewLines={3}
      />
    </Section>
  );
}
