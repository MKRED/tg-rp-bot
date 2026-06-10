import { SAMPLING_SPECS, type SamplingKey, type SamplingState } from "./param-specs";
import { SamplingSlider } from "./SamplingSlider";

interface SamplingSectionProps {
  state: SamplingState;
  onChange: (key: SamplingKey, value: number, enabled: boolean) => void;
}

/** Секция параметров сэмплинга: рендерит слайдер на каждый SAMPLING_SPECS. */
export function SamplingSection({ state, onChange }: SamplingSectionProps) {
  return (
    <div className="preset-sampling">
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
    </div>
  );
}
