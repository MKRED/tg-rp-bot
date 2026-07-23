import { ExpandableTextarea } from "../ExpandableTextarea";
import { FieldHint } from "../FieldHint";
import { estimateTokens } from "../../text/tokens";
import "./PromptField.css";

interface PromptFieldProps {
  label: string;
  hint: string;
  value: string;
  rows?: number;
  placeholder?: string;
  onChange: (value: string) => void;
  /** Необязательный blur — напр. сохранение поля по потере фокуса. */
  onBlur?: () => void;
}

/** Поле промпта: Textarea с подписью, подсказкой и счётчиком «~N токенов». */
export function PromptField({
  label,
  hint,
  value,
  rows = 4,
  placeholder,
  onChange,
  onBlur,
}: PromptFieldProps) {
  return (
    <div className="prompt-field">
      <ExpandableTextarea
        header={label}
        placeholder={placeholder}
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      <div className="prompt-field__meta">
        <FieldHint>{hint}</FieldHint>
        <span className="prompt-field__tokens">~{estimateTokens(value)} токенов</span>
      </div>
    </div>
  );
}
