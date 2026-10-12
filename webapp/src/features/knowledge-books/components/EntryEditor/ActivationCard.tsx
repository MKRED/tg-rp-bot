import { Collapse, NumberInput, SegmentedControl, Stack, Switch, TagsInput } from "@mantine/core";
import { SettingsCard } from "../../../../shared/components/SettingsCard";
import type { EntryActivation } from "../../types/book";
import { MAX_ENTRY_FIELD_LENGTH, MAX_KEYWORD_DEPTH, MIN_KEYWORD_DEPTH } from "../../types/book";

interface ActivationCardProps {
  enabled: boolean;
  activation: EntryActivation;
  keywords: string[];
  /** Строка — поле очищено при вводе; на сохранении пустое заменяется значением по умолчанию. */
  keywordDepth: number | string;
  onEnabled: (value: boolean) => void;
  onActivation: (value: EntryActivation) => void;
  onKeywords: (value: string[]) => void;
  onKeywordDepth: (value: number | string) => void;
}

const ACTIVATION_OPTIONS = [
  { value: "always_on", label: "Всегда" },
  { value: "keyword", label: "По ключевым словам" },
];

/**
 * Карточка «Когда срабатывает»: включена ли запись и как попадает в промпт — всегда или только когда
 * триггер-слово встретилось в последних сообщениях истории.
 */
export function ActivationCard({
  enabled,
  activation,
  keywords,
  keywordDepth,
  onEnabled,
  onActivation,
  onKeywords,
  onKeywordDepth,
}: ActivationCardProps) {
  return (
    <SettingsCard title="Когда срабатывает">
      <Switch
        label="Включена"
        description="Выключенная запись не попадает в промпт, но сохраняется в книге."
        checked={enabled}
        onChange={(e) => onEnabled(e.currentTarget.checked)}
      />
      {/* Переключатель и раскрывашка — один ребёнок Stack карточки: свёрнутый Collapse отдельным
          ребёнком получил бы gap и оставил пустую полосу. */}
      <div>
        <SegmentedControl
          fullWidth
          data={ACTIVATION_OPTIONS}
          value={activation}
          onChange={(v) => onActivation(v as EntryActivation)}
        />
        <Collapse expanded={activation === "keyword"}>
          <Stack gap="md" pt="md">
            <TagsInput
              label="Триггер-слова"
              description="Слово и Enter. Нужно хотя бы одно — иначе запись никогда не сработает."
              withAsterisk
              value={keywords}
              onChange={onKeywords}
              maxLength={MAX_ENTRY_FIELD_LENGTH}
              // Набранное, но не подтверждённое Enter слово не пропадает при уходе из поля.
              acceptValueOnBlur
              clearable
            />
            <NumberInput
              label="Искать в последних сообщениях"
              description="Сколько последних сообщений (пользователь + модель) проверять на триггер-слова."
              value={keywordDepth}
              onChange={onKeywordDepth}
              min={MIN_KEYWORD_DEPTH}
              max={MAX_KEYWORD_DEPTH}
              clampBehavior="strict"
              allowDecimal={false}
              allowNegative={false}
              hideControls
              inputMode="numeric"
            />
          </Stack>
        </Collapse>
      </div>
    </SettingsCard>
  );
}
