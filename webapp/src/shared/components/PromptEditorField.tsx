import { Cell, IconButton, Tooltip } from "@telegram-apps/telegram-ui";
import { ChevronRight, Info } from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { estimateTokens } from "../text/tokens";
import { PromptEditorOverlay } from "./PromptEditorOverlay";
import "./PromptEditorField.css";

interface PromptEditorFieldProps {
  header: string;
  hint?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  /** Число строк клипа превью (-webkit-line-clamp). По умолчанию 4. */
  previewLines?: number;
}

/**
 * Замена PromptField/ExpandableTextarea: tgui Cell с превью текста промпта (клип по строкам вместо
 * разворачивания на месте), тап открывает PromptEditorOverlay для редактирования на весь экран.
 * Meta-строка — иконка-подсказка (hint по тапу через Tooltip, а не текстом на всю ширину — экономит
 * место под форму) + счётчик токенов.
 */
export function PromptEditorField({
  header,
  hint,
  placeholder,
  value,
  onChange,
  previewLines = 4,
}: PromptEditorFieldProps) {
  const [open, setOpen] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const hintButtonRef = useRef<HTMLButtonElement>(null);

  // Закрытие подсказки по клику вне кнопки — как в LangPicker.
  useEffect(() => {
    if (!hintOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (hintButtonRef.current && !hintButtonRef.current.contains(e.target as Node)) setHintOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [hintOpen]);

  return (
    <div className="prompt-editor-field">
      <Cell
        multiline
        after={<ChevronRight size={20} className="prompt-editor-field__chevron" />}
        subtitle={
          <span
            className={`prompt-editor-field__preview${value ? "" : " prompt-editor-field__preview--placeholder"}`}
            style={{ WebkitLineClamp: previewLines }}
          >
            {value || placeholder || "Нажмите, чтобы заполнить"}
          </span>
        }
        onClick={() => setOpen(true)}
      >
        {header}
      </Cell>

      <div className="prompt-editor-field__meta">
        {hint && (
          <>
            <IconButton
              ref={hintButtonRef}
              size="s"
              mode="plain"
              className="prompt-editor-field__hint-button"
              aria-label="Подсказка"
              onClick={() => setHintOpen((v) => !v)}
            >
              <Info size={16} />
            </IconButton>
            {hintOpen && (
              <Tooltip
                targetRef={hintButtonRef as RefObject<HTMLElement>}
                className="prompt-editor-field__hint-tooltip"
              >
                {hint}
              </Tooltip>
            )}
          </>
        )}
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
