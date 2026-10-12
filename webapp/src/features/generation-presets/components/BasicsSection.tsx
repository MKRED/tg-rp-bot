import { Collapse, NumberInput, Switch, TextInput } from "@mantine/core";
import { SettingsCard } from "../../../shared/components/SettingsCard";

interface BasicsSectionProps {
  name: string;
  contextUnlimited: boolean;
  /** Пустая строка — поле очищено (на submit уйдёт null). */
  contextSize: string | number;
  maxTokens: string | number;
  streaming: boolean;
  onName: (value: string) => void;
  onContextUnlimited: (value: boolean) => void;
  onContextSize: (value: string | number) => void;
  onMaxTokens: (value: string | number) => void;
  onStreaming: (value: boolean) => void;
}

/** Общие лимиты токенов, целое ≥ 1 с разделителем разрядов (8 192 читается лучше 8192). */
const tokenInputProps = {
  allowDecimal: false,
  allowNegative: false,
  min: 1,
  thousandSeparator: " ",
  hideControls: true,
  inputMode: "numeric",
} as const;

/** Карточка «Основное»: название, лимиты токенов (контекст/ответ), стриминг. */
export function BasicsSection({
  name,
  contextUnlimited,
  contextSize,
  maxTokens,
  streaming,
  onName,
  onContextUnlimited,
  onContextSize,
  onMaxTokens,
  onStreaming,
}: BasicsSectionProps) {
  return (
    <SettingsCard title="Основное">
      <TextInput
        label="Название"
        placeholder="Название пресета"
        withAsterisk
        value={name}
        onChange={(e) => onName(e.currentTarget.value)}
      />
      {/* Тумблер и раскрывашка — один ребёнок Stack: свёрнутый Collapse отдельным ребёнком всё равно
          получил бы gap и дал двойной отступ. Поэтому отступ — внутри раскрываемого блока. */}
      <div>
        <Switch
          label="Неограниченный контекст"
          description="Не урезать историю — отправлять модели всё, что помещается в её окно."
          checked={contextUnlimited}
          onChange={(e) => onContextUnlimited(e.currentTarget.checked)}
        />
        {/* Размер контекста не нужен при неограниченном — прячем с анимацией высоты; значение остаётся
            в состоянии формы, так что повторное выключение тумблера его не теряет. */}
        <Collapse expanded={!contextUnlimited}>
          <NumberInput
            pt="md"
            label="Размер контекста, токенов"
            description="Сколько токенов истории удерживать в запросе."
            placeholder="Например, 8 192"
            value={contextSize}
            onChange={onContextSize}
            {...tokenInputProps}
          />
        </Collapse>
      </div>
      <NumberInput
        label="Максимальная длина ответа, токенов"
        description="Верхняя граница длины ответа модели."
        placeholder="Например, 1 024"
        value={maxTokens}
        onChange={onMaxTokens}
        {...tokenInputProps}
      />
      <Switch
        label="Стриминг текста"
        description="Показывать ответ по мере генерации, а не целиком в конце."
        checked={streaming}
        onChange={(e) => onStreaming(e.currentTarget.checked)}
      />
    </SettingsCard>
  );
}
