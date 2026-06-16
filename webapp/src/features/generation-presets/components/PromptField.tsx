import { ExpandableTextarea } from "../../../shared/components/ExpandableTextarea";
import { estimateTokens } from "../../../shared/text/tokens";

interface PromptFieldProps {
  label: string;
  hint: string;
  value: string;
  rows?: number;
  placeholder?: string;
  onChange: (value: string) => void;
}

/** Поле промпта: Textarea с подписью, подсказкой и счётчиком «~N токенов». */
export function PromptField({
  label,
  hint,
  value,
  rows = 4,
  placeholder,
  onChange,
}: PromptFieldProps) {
  return (
    <div className="preset-field">
      <ExpandableTextarea
        header={label}
        placeholder={placeholder}
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="preset-field__meta">
        <span className="preset-field__hint">{hint}</span>
        <span className="preset-field__tokens">~{estimateTokens(value)} токенов</span>
      </div>
    </div>
  );
}
