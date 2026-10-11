import { ActionIcon, Text, TextInput } from "@mantine/core";
import { Minus, Plus } from "lucide-react";
import { useEffect, useId, useState } from "react";
import styles from "./StepperField.module.css";

interface StepperFieldProps {
  label: string;
  description?: string;
  value: number;
  min: number;
  /** Новое целое значение ≥ min — на ±, blur или Enter. */
  onCommit: (value: number) => void;
}

/**
 * Числовая настройка: подпись слева, степпер «− N +» справа. Кнопки меняют и сразу коммитят; ручной
 * ввод коммитится на blur/Enter, а не на каждый символ (иначе правка дёргала бы API). Пустой или
 * некорректный ввод откатывается к последнему валидному значению.
 */
export function StepperField({ label, description, value, min, onCommit }: StepperFieldProps) {
  const id = useId();
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  const commit = () => {
    const n = Number(text);
    // Значение не менялось — не коммитим: тап по ± из фокуса в поле сначала даёт blur, и без этой
    // проверки ушло бы два сохранения подряд.
    if (text.trim() !== "" && Number.isFinite(n) && n >= min) {
      if (Math.floor(n) !== value) onCommit(Math.floor(n));
    } else setText(String(value));
  };

  const step = (delta: number) => {
    const base = Number.isFinite(Number(text)) ? Math.floor(Number(text)) : value;
    const next = Math.max(min, base + delta);
    setText(String(next));
    onCommit(next);
  };

  return (
    <div className={styles.row}>
      <div className={styles.text}>
        <Text component="label" htmlFor={id} fw={500}>
          {label}
        </Text>
        {description && (
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        )}
      </div>
      <div className={styles.stepper}>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="xl"
          aria-label={`${label}: меньше`}
          disabled={Number(text) <= min}
          onClick={() => step(-1)}
        >
          <Minus size={18} />
        </ActionIcon>
        <TextInput
          id={id}
          inputMode="numeric"
          value={text}
          classNames={{ input: styles.input }}
          onChange={(e) => setText(e.currentTarget.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            // Enter — явный коммит (через blur, чтобы не коммитить дважды).
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
        <ActionIcon variant="subtle" color="gray" size="xl" aria-label={`${label}: больше`} onClick={() => step(1)}>
          <Plus size={18} />
        </ActionIcon>
      </div>
    </div>
  );
}
