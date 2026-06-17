import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LANG_OPTIONS } from "../lib/translate-options";

interface LangPickerProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Пикер целевого языка перевода. Вместо нативного <select> рисует свой список прямо в интерфейсе
 * шторы (нативное меню в Telegram webview выглядит чужеродно). Закрывается по выбору или клику вне.
 */
export function LangPicker({ value, onChange }: LangPickerProps) {
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

  const current = LANG_OPTIONS.find((o) => o.value === value);

  return (
    <div className="lang-picker" ref={rootRef}>
      <button
        type="button"
        className="lang-picker__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Язык перевода"
      >
        <span>{current?.label ?? value}</span>
        <ChevronDown
          size={16}
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
        />
      </button>
      {open && (
        <ul className="lang-picker__menu" role="listbox">
          {LANG_OPTIONS.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                className={`lang-picker__option${o.value === value ? " is-active" : ""}`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <span>{o.label}</span>
                {o.value === value && <Check size={16} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
