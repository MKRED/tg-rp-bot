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
 * Замена ExpandableTextarea: превью текста промпта в несколько строк (обрезка многоточием),
 * тап открывает PromptEditorOverlay для редактирования на весь экран.
 */
export function PromptEditorField({ header, placeholder, value, onChange }: PromptEditorFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="prompt-editor-field" onClick={() => setOpen(true)}>
        <span className="prompt-editor-field__header">{header}</span>
        <span
          className={`prompt-editor-field__preview${value ? "" : " prompt-editor-field__preview--placeholder"}`}
        >
          {value || placeholder}
        </span>
      </button>

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
