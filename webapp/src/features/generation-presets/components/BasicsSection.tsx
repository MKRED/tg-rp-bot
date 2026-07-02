import { Input } from "@telegram-apps/telegram-ui";
import { HintedInput } from "../../../shared/components/HintedInput";
import { SwitchRow } from "./SwitchRow";

interface BasicsSectionProps {
  name: string;
  contextUnlimited: boolean;
  /** Хранятся строками, чтобы поле можно было очистить (пусто → null на submit). */
  contextSize: string;
  maxTokens: string;
  streaming: boolean;
  onName: (value: string) => void;
  onContextUnlimited: (value: boolean) => void;
  onContextSize: (value: string) => void;
  onMaxTokens: (value: string) => void;
  onStreaming: (value: boolean) => void;
}

/** Базовые поля: название, лимиты токенов (контекст/ответ), стриминг. */
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
    <>
      <Input
        header="Название"
        placeholder="Название пресета"
        value={name}
        onChange={(e) => onName(e.target.value)}
      />

      <SwitchRow
        label="Неограниченный размер контекста"
        hint="Не урезать историю — отправлять модели всё, что помещается в её окно."
        checked={contextUnlimited}
        onChange={onContextUnlimited}
      />

      {/* Размер контекста скрыт, когда выбран неограниченный. */}
      {!contextUnlimited && (
        <HintedInput
          header="Размер контекста (токены)"
          type="number"
          inputMode="numeric"
          placeholder="Например, 8192"
          hint="Сколько токенов истории удерживать в запросе."
          value={contextSize}
          onChange={(e) => onContextSize(e.target.value)}
        />
      )}

      <HintedInput
        header="Максимальная длина ответа (токены)"
        type="number"
        inputMode="numeric"
        placeholder="Например, 1024"
        hint="Верхняя граница длины ответа модели в токенах."
        value={maxTokens}
        onChange={(e) => onMaxTokens(e.target.value)}
      />

      <SwitchRow
        label="Стриминг текста"
        hint="Показывать ответ по мере генерации, а не целиком в конце."
        checked={streaming}
        onChange={onStreaming}
      />
    </>
  );
}
