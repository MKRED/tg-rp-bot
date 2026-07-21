import { Cell } from "@telegram-apps/telegram-ui";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { PromptEditorOverlay } from "./PromptEditorOverlay";
import "./PromptEditorField.css";

interface PromptEditorFieldProps {
  header: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}

/**
 * Замена ExpandableTextarea: tgui Cell с превью текста промпта (клип по строкам вместо
 * разворачивания на месте), тап открывает PromptEditorOverlay для редактирования на весь экран.
 */
export function PromptEditorField({ header, placeholder, value, onChange }: PromptEditorFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
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
    </>
  );
}
