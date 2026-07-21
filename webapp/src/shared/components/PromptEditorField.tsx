import { Cell } from "@telegram-apps/telegram-ui";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { FieldHint } from "./FieldHint";
import { estimateTokens } from "../text/tokens";
import { PromptEditorOverlay } from "./PromptEditorOverlay";
import "./PromptEditorField.css";

interface PromptEditorFieldProps {
  header: string;
  hint?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}

/**
 * Замена PromptField/ExpandableTextarea: tgui Cell с превью текста промпта (клип по строкам вместо
 * разворачивания на месте), тап открывает PromptEditorOverlay для редактирования на весь экран.
 * Meta-строка (hint + счётчик токенов) — как у старого PromptField, но теперь внутри компонента,
 * чтобы не дублировать эту вёрстку в каждой форме.
 */
export function PromptEditorField({ header, hint, placeholder, value, onChange }: PromptEditorFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="prompt-editor-field">
      <Cell
        multiline
        after={<ChevronRight size={20} className="prompt-editor-field__chevron" />}
        subtitle={
          <span
            className={`prompt-editor-field__preview${value ? "" : " prompt-editor-field__preview--placeholder"}`}
          >
            {value || placeholder}
          </span>
        }
        onClick={() => setOpen(true)}
      >
        {header}
      </Cell>

      <div className="prompt-editor-field__meta">
        {hint && <FieldHint>{hint}</FieldHint>}
        <span className="prompt-editor-field__tokens">~{estimateTokens(value)} токенов</span>
      </div>

      {open && (
        <PromptEditorOverlay
          title={header}
          placeholder={placeholder}
          value={value}
          onSave={(next) => {
            onChange(next);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      )}
    </div>
  );
}
