import { Slider, Switch } from "@telegram-apps/telegram-ui";
import type { SamplingSpec } from "./param-specs";

interface SamplingSliderProps {
  spec: SamplingSpec;
  /** Текущее значение (сохраняется даже когда тумблер выключен — чтобы off→on не терял ввод). */
  value: number;
  /** Включена ли передача параметра в запрос. Выключен → слайдер неактивен, в payload уйдёт null. */
  enabled: boolean;
  onValue: (value: number) => void;
  onEnabled: (enabled: boolean) => void;
}

/** Форматирование значения: целое для шага ≥1 (topK), иначе два знака. */
function formatValue(value: number, step: number): string {
  return step >= 1 ? String(value) : value.toFixed(2);
}

/**
 * Один параметр сэмплинга: подпись + тумблер «передавать» + слайдер с видимым диапазоном
 * и текущим значением + подсказка. Значение и флаг включения — независимые поля состояния
 * (хранятся в PresetForm), поэтому выключение тумблера не стирает выбранное число.
 */
export function SamplingSlider({ spec, value, enabled, onValue, onEnabled }: SamplingSliderProps) {
  return (
    <div className="preset-slider">
      <div className="preset-slider__head">
        <span className="preset-slider__label">{spec.label}</span>
        <span className="preset-slider__value">
          {enabled ? formatValue(value, spec.step) : "—"}
        </span>
        <Switch checked={enabled} onChange={(e) => onEnabled(e.target.checked)} />
      </div>
      <Slider
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={value}
        disabled={!enabled}
        onChange={(v) => onValue(v)}
      />
      <span className="preset-field__hint">{spec.hint}</span>
    </div>
  );
}
