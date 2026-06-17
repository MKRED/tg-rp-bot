import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { REASONING_EFFORTS, REASONING_EFFORT_LABELS, type ReasoningEffort } from "../types/preset";

interface EffortPickerProps {
  value: ReasoningEffort;
  onChange: (value: ReasoningEffort) => void;
}

/**
 * Выпадающий список уровня рассуждения — свой, по образцу LangPicker из rp-chat. Нативный <Select>
 * в Telegram webview на ПК (Chromium) рисует попап системно-белым, светлый текст на нём не виден.
 * Закрывается по выбору или клику вне.
 */
export function EffortPicker({ value, onChange }: EffortPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Закрытие по клику вне пикера.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div className="preset-picker" ref={rootRef}>
      <div className="preset-picker__header">Уровень рассуждения</div>
      <button
        type="button"
        className="preset-picker__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{REASONING_EFFORT_LABELS[value]}</span>
        <ChevronDown
          size={18}
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
        />
      </button>
      {open && (
        <ul className="preset-picker__menu" role="listbox">
          {REASONING_EFFORTS.map((effort) => (
            <li key={effort}>
              <button
                type="button"
                role="option"
                aria-selected={effort === value}
                className={`preset-picker__option${effort === value ? " is-active" : ""}`}
                onClick={() => {
                  onChange(effort);
                  setOpen(false);
                }}
              >
                <span>{REASONING_EFFORT_LABELS[effort]}</span>
                {effort === value && <Check size={16} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
