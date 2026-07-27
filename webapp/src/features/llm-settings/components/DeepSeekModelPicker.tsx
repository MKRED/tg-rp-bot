import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface DeepSeekModelPickerProps {
  value: string | null;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * Выпадающий список моделей DeepSeek — свой, по образцу EffortPicker
 * (webapp/src/features/generation-presets/components/EffortPicker.tsx): нативный <select>
 * в Telegram webview на ПК (Chromium) рисует попап системно-белым, светлый текст на нём не виден.
 * options приходят из GET /models (см. useLlmSettings.verify) — заранее неизвестны, поэтому список
 * динамический, а не константа, как в EffortPicker.
 */
export function DeepSeekModelPicker({ value, options, onChange, disabled }: DeepSeekModelPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const isDisabled = disabled || options.length === 0;

  return (
    <div className="llm-model-picker" ref={rootRef}>
      <button
        type="button"
        className="llm-model-picker__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={isDisabled}
      >
        <span>{value ?? "Модель не выбрана"}</span>
        <ChevronDown
          size={16}
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
        />
      </button>
      {open && (
        <ul className="llm-model-picker__menu" role="listbox">
          {options.map((model) => (
            <li key={model}>
              <button
                type="button"
                role="option"
                aria-selected={model === value}
                className={`llm-model-picker__option${model === value ? " is-active" : ""}`}
                onClick={() => {
                  onChange(model);
                  setOpen(false);
                }}
              >
                <span>{model}</span>
                {model === value && <Check size={14} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
