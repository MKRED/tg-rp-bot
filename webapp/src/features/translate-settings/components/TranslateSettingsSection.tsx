import { Button, Cell, Section } from "@telegram-apps/telegram-ui";
import { LangPicker } from "../../../shared/components/LangPicker";
import { SegmentedToggle } from "../../../shared/components/SegmentedToggle";
import { LANG_OPTIONS } from "../../../shared/constants/lang-options";
import type { useTranslateSettings } from "../hooks/useTranslateSettings";
import type { TranslateSettings } from "../types/translateSettings";
import "./TranslateSettingsSection.css";

const ENGINE_OPTIONS = [
  { value: "google", label: "Google" },
  { value: "ai", label: "ИИ" },
] as const satisfies { value: TranslateSettings["engine"]; label: string }[];

type TranslateSettingsSectionProps = Omit<ReturnType<typeof useTranslateSettings>, "loading">;

/**
 * Секция настроек «Перевод в редакторе» — дефолты режима перевода в PromptEditorOverlay (движок,
 * целевой язык, свой ИИ-промпт). Обычная textarea для промпта, не PromptEditorField/-Overlay —
 * последний создал бы обратную зависимость settings-фичи на компонент, который сама эта фича
 * конфигурирует, да и текст промпта тут короткий (не 6000-токенный).
 */
export function TranslateSettingsSection({
  settings,
  saving,
  promptDraft,
  setPromptDraft,
  setEngine,
  setTargetLang,
  savePromptTemplate,
  resetPromptTemplate,
}: TranslateSettingsSectionProps) {
  const promptChanged = promptDraft !== (settings.promptTemplate ?? "");

  return (
    <Section className="section-blend-inputs" header="Перевод в редакторе">
      <div className="translate-settings">
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
        <Cell
          subtitle="Целевой язык по умолчанию"
          after={<LangPicker value={settings.targetLang} onChange={setTargetLang} options={LANG_OPTIONS} />}
        >
          Язык
        </Cell>
        <Cell
          multiline
          subtitle="Плейсхолдер {{target_lang}} подставляется английским названием языка. Пусто — используется дефолтный промпт."
        >
          Свой промпт ИИ-перевода
        </Cell>
        <textarea
          className="translate-settings__prompt"
          value={promptDraft}
          onChange={(e) => setPromptDraft(e.target.value)}
          placeholder="You are a translation engine. Translate into {{target_lang}}…"
          rows={3}
        />
        {promptChanged && (
          <div className="translate-settings__prompt-actions">
            <Button size="s" mode="bezeled" disabled={saving} onClick={savePromptTemplate}>
              Сохранить промпт
            </Button>
            <Button size="s" mode="outline" disabled={saving} onClick={resetPromptTemplate}>
              Сбросить
            </Button>
          </div>
        )}
      </div>
    </Section>
  );
}
