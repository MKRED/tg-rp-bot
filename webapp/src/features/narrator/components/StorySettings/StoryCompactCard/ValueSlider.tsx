import { Group, Slider, Text } from "@mantine/core";
import { useEffect, useState } from "react";

interface ValueSliderProps {
  label: string;
  hint: string;
  format: (value: number) => string;
  min: number;
  max: number;
  step: number;
  /** Сохранённое значение. */
  value: number;
  /** Зовётся, когда палец отпущен (onChangeEnd), а не на каждый шаг — чтобы не слать запрос на тик. */
  onCommit: (value: number) => void;
}

/** Ползунок с подписью и текущим значением справа; пока его тянут, значение держит сам. */
export function ValueSlider({ label, hint, format, min, max, step, value, onCommit }: ValueSliderProps) {
  const [local, setLocal] = useState(value);

  // Сохранённое значение поменялось (загрузка, откат после ошибки) — показываем его.
  useEffect(() => setLocal(value), [value]);

  return (
    <div>
      <Group justify="space-between" gap="xs" mb={6}>
        <Text size="sm" fw={500}>
          {label}
        </Text>
        <Text size="sm" c="dimmed">
          {format(local)}
        </Text>
      </Group>
      <Slider
        min={min}
        max={max}
        step={step}
        value={local}
        label={null}
        onChange={setLocal}
        // onChangeEnd приходит и на простое касание без сдвига — тогда сохранять нечего (иначе значение по
        // умолчанию, например 70% лимита, записалось бы как явное).
        onChangeEnd={(v) => v !== value && onCommit(v)}
        aria-label={label}
      />
      <Text size="xs" c="dimmed" mt={6}>
        {hint}
      </Text>
    </div>
  );
}
