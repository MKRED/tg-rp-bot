import { Collapse, Input, SegmentedControl, Select, Stack, Switch } from "@mantine/core";
import { SettingsCard } from "../../../../shared/components/SettingsCard";
import { AUTO_SCOPE_OPTIONS, LANG_OPTIONS, METHOD_OPTIONS, SCOPE_OPTIONS } from "../../lib/translate-options";
import type { ChatSettings } from "../../types/chat";

interface ChatTranslateCardProps {
  settings: ChatSettings;
  onUpdate: (patch: Partial<ChatSettings>) => void;
}

/** Перевод сообщений чата: тумблер, а под ним — метод, язык, где показывать кнопку и автоперевод. */
export function ChatTranslateCard({ settings, onUpdate }: ChatTranslateCardProps) {
  return (
    <SettingsCard title="Перевод">
      {/* Тумблер и раскрывающиеся поля — в одном блоке: свёрнутый Collapse не получает отступ Stack. */}
      <div>
        <Switch
          label="Перевод сообщений"
          description="Кнопка перевода под сообщениями"
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
                onChange={(v) => onUpdate({ translateMethod: v as ChatSettings["translateMethod"] })}
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
              data={SCOPE_OPTIONS}
              value={settings.translateScope}
              allowDeselect={false}
              onChange={(v) => v && onUpdate({ translateScope: v as ChatSettings["translateScope"] })}
            />
            <Select
              label="Автоперевод"
              description="Переводить новые сообщения сразу"
              data={AUTO_SCOPE_OPTIONS}
              value={settings.autoTranslateScope}
              allowDeselect={false}
              onChange={(v) => v && onUpdate({ autoTranslateScope: v as ChatSettings["autoTranslateScope"] })}
            />
          </Stack>
        </Collapse>
      </div>
    </SettingsCard>
  );
}
