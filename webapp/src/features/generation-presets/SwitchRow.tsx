import { Switch } from "@telegram-apps/telegram-ui";

interface SwitchRowProps {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

/** Строка-галочка: подпись + подсказка слева, Switch справа. Переиспользуется в секциях формы. */
export function SwitchRow({ label, hint, checked, disabled, onChange }: SwitchRowProps) {
  return (
    <div className="preset-switchrow">
      <div className="preset-switchrow__text">
        <span className="preset-switchrow__label">{label}</span>
        {hint && <span className="preset-field__hint">{hint}</span>}
      </div>
      <Switch checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </div>
  );
}
