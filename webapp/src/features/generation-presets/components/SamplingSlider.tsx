import { Collapse, Slider, Switch, Text } from "@mantine/core";
import type { SamplingSpec } from "../lib/param-specs";
import styles from "./SamplingSlider.module.css";

interface SamplingSliderProps {
  spec: SamplingSpec;
  /** Текущее значение (сохраняется даже когда тумблер выключен — чтобы off→on не терял ввод). */
  value: number;
  /** Включена ли передача параметра в запрос. Выключен → слайдер спрятан, в payload уйдёт null. */
  enabled: boolean;
  onValue: (value: number) => void;
  onEnabled: (enabled: boolean) => void;
}

/** Форматирование значения: целое для шага ≥1, иначе два знака. */
function formatValue(value: number, step: number): string {
  return step >= 1 ? String(value) : value.toFixed(2);
}

/**
 * Один параметр сэмплинга: тумблер «передавать» с подсказкой и текущим значением справа, под ним —
 * слайдер, раскрывающийся только у включённых параметров (выключенных большинство — так карточка
 * остаётся короткой). Значение и флаг включения — независимые поля состояния PresetForm, поэтому
 * выключение тумблера не стирает выбранное число.
 */
export function SamplingSlider({ spec, value, enabled, onValue, onEnabled }: SamplingSliderProps) {
  const format = (v: number) => formatValue(v, spec.step);
  return (
    <div>
      <div className={styles.head}>
        <Switch
          className={styles.switch}
          label={spec.label}
          description={spec.hint}
          checked={enabled}
          onChange={(e) => onEnabled(e.currentTarget.checked)}
        />
        {enabled && (
          <Text fw={500} className={styles.value}>
            {format(value)}
          </Text>
        )}
      </div>
      <Collapse expanded={enabled}>
        <Slider
          className={styles.slider}
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={value}
          label={format}
          thumbLabel={spec.label}
          marks={[
            { value: spec.min, label: format(spec.min) },
            { value: spec.max, label: format(spec.max) },
          ]}
          onChange={onValue}
        />
      </Collapse>
    </div>
  );
}
