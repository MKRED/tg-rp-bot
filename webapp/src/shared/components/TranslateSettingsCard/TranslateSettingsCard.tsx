import { Collapse, Input, SegmentedControl, Select, Stack, Switch } from "@mantine/core";
import type { AutoTranslateScope, PromptTranslateEngine, TranslateScope } from "@tg-rp-bot/shared";
import { LANG_OPTIONS } from "../../constants/lang-options";
import { SettingsCard } from "../SettingsCard";

/** Настройки перевода сообщений — общая часть настроек RP-чата и истории рассказчика. */
export interface MessageTranslateSettings {
  translateEnabled: boolean;
  translateMethod: PromptTranslateEngine;
  translateTargetLang: string;
  translateScope: TranslateScope;
  autoTranslateScope: AutoTranslateScope;
}

interface TranslateSettingsCardProps {
  settings: MessageTranslateSettings;
  onUpdate: (patch: Partial<MessageTranslateSettings>) => void;
  /** Подписи «где показывать» и «автоперевод» — у фичи свои слова (ответы ИИ / биты, мои сообщения / директивы). */
  scopeOptions: { value: TranslateScope; label: string }[];
  autoScopeOptions: { value: AutoTranslateScope; label: string }[];
  /** Пояснение под тумблером. */
  description: string;
}

const METHOD_OPTIONS = [
  { value: "google", label: "Google" },
  { value: "ai", label: "ИИ" },
] satisfies { value: PromptTranslateEngine; label: string }[];

/** Перевод сообщений: тумблер, а под ним — метод, язык, где показывать кнопку и автоперевод. */
export function TranslateSettingsCard({
  settings,
  onUpdate,
  scopeOptions,
  autoScopeOptions,
  description,
}: TranslateSettingsCardProps) {
  return (
    <SettingsCard title="Перевод">
      {/* Тумблер и раскрывающиеся поля — в одном блоке: свёрнутый Collapse не получает отступ Stack. */}
      <div>
        <Switch
          label="Перевод сообщений"
          description={description}
          checked={settings.translateEnabled}
          onChange={(e) => onUpdate({ translateEnabled: e.currentTarget.checked })}
        />
        <Collapse expanded={settings.translateEnabled}>
          <Stack gap="md" pt="md">
            <Input.Wrapper label="Метод" description="Google Translate или запрос к ИИ" size="md">
              <SegmentedControl
                fullWidth
                mt={6}
                data={METHOD_OPTIONS}
                value={settings.translateMethod}
                onChange={(v) => onUpdate({ translateMethod: v as PromptTranslateEngine })}
              />
            </Input.Wrapper>
            <Select
              label="Язык"
              data={LANG_OPTIONS}
              value={settings.translateTargetLang}
              allowDeselect={false}
              onChange={(v) => v && onUpdate({ translateTargetLang: v })}
            />
            <Select
              label="Где показывать кнопку"
              data={scopeOptions}
              value={settings.translateScope}
              allowDeselect={false}
              onChange={(v) => v && onUpdate({ translateScope: v as TranslateScope })}
            />
            <Select
              label="Автоперевод"
              description="Переводить новые сообщения сразу"
              data={autoScopeOptions}
              value={settings.autoTranslateScope}
              allowDeselect={false}
              onChange={(v) => v && onUpdate({ autoTranslateScope: v as AutoTranslateScope })}
            />
          </Stack>
        </Collapse>
      </div>
    </SettingsCard>
  );
}
