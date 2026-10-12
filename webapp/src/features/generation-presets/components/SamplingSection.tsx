import { SettingsCard } from "../../../shared/components/SettingsCard";
import { SAMPLING_SPECS, type SamplingKey, type SamplingState } from "../lib/param-specs";
import { SamplingSlider } from "./SamplingSlider";

interface SamplingSectionProps {
  state: SamplingState;
  onChange: (key: SamplingKey, value: number, enabled: boolean) => void;
}

/** Карточка параметров сэмплинга: тумблер + слайдер на каждый SAMPLING_SPECS. */
export function SamplingSection({ state, onChange }: SamplingSectionProps) {
  return (
    <SettingsCard
      title="Сэмплинг"
      description="Тонкая настройка выбора слов. Выключенные параметры не передаются — модель берёт свои значения."
    >
      {SAMPLING_SPECS.map((spec) => {
        const field = state[spec.key];
        return (
          <SamplingSlider
            key={spec.key}
            spec={spec}
            value={field.value}
            enabled={field.enabled}
            onValue={(value) => onChange(spec.key, value, field.enabled)}
            onEnabled={(enabled) => onChange(spec.key, field.value, enabled)}
          />
        );
      })}
    </SettingsCard>
  );
}
