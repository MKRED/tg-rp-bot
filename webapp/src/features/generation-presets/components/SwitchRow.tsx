import { Switch } from "@telegram-apps/telegram-ui";
import { FieldHint } from "../../../shared/components/FieldHint";

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
        {hint && <FieldHint>{hint}</FieldHint>}
      </div>
      {/* Обёртка с flex-shrink:0 — иначе длинный текст слева ужимает Switch и ломает его вид. */}
      <span className="preset-switch">
        <Switch checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      </span>
    </div>
  );
}
